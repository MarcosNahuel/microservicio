const express = require("express");
const multer = require("multer");
const axios = require("axios");
const path = require("path");
const { URL } = require("url");
const winston = require("winston");

class ValidationError extends Error {}
class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const app = express();

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()]
});

const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT || "1mb";
const MAX_UPLOAD_BYTES = toNumber(process.env.MAX_UPLOAD_BYTES, 25 * 1024 * 1024);
const REMOTE_FETCH_TIMEOUT_MS = toNumber(process.env.REMOTE_FETCH_TIMEOUT_MS, 20000);
const KOMMO_TIMEOUT_MS = toNumber(process.env.KOMMO_TIMEOUT_MS, 20000);
const MAX_REMOTE_BYTES = toNumber(process.env.MAX_REMOTE_BYTES, MAX_UPLOAD_BYTES);
const MAX_REDIRECTS = toNumber(process.env.MAX_REDIRECTS, 3);
const KOMMO_MAX_RETRIES = Math.max(1, toNumber(process.env.KOMMO_MAX_RETRIES, 1));

const MIME_EXTENSION_MAP = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/bmp": ".bmp",
  "image/tiff": ".tiff",
  "image/svg+xml": ".svg",
  "application/pdf": ".pdf"
};

const EXTENSION_MIME_MAP = Object.entries(MIME_EXTENSION_MAP).reduce((acc, [mime, ext]) => {
  acc[ext] = mime;
  return acc;
}, {});

app.use(express.json({ limit: JSON_BODY_LIMIT }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith("image/")) {
      cb(null, true);
      return;
    }
    cb(new ValidationError("Solo se permiten archivos de imagen"));
  }
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/process-url", async (req, res, next) => {
  try {
    const { image_url: imageUrl, drive_url: driveUrl, access_token: accessToken, file_name: overrideFileName } = req.body || {};
    if (!imageUrl || typeof imageUrl !== "string") {
      throw new ValidationError("image_url es requerido");
    }

    const normalizedDrive = normalizeDriveUrl(driveUrl);
    const token = ensureToken(accessToken);

    const remote = await fetchRemoteImage(imageUrl, overrideFileName);
    const uploadResult = await uploadBufferToKommo({
      buffer: remote.buffer,
      fileName: remote.fileName,
      mimeType: remote.mimeType,
      driveUrl: normalizedDrive,
      accessToken: token
    });

    logger.info("Imagen subida a Kommo", {
      origin: "process-url",
      driveUrl: normalizedDrive,
      sessionUuid: uploadResult.session?.uuid || null,
      kommoFileUuid: uploadResult.upload?.uuid || null,
      fileName: remote.fileName,
      fileSize: remote.buffer.length
    });

    res.json({
      success: true,
      source: {
        image_url: imageUrl
      },
      file: {
        name: remote.fileName,
        size: remote.buffer.length,
        mime_type: remote.mimeType
      },
      kommo: formatKommoResponse(uploadResult)
    });
  } catch (error) {
    next(error);
  }
});

app.post("/upload", upload.single("image"), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new ValidationError("El campo 'image' es requerido");
    }

    const normalizedDrive = normalizeDriveUrl(req.body?.drive_url);
    const token = ensureToken(req.body?.access_token);

    const fileName = buildFileName(req.body?.file_name || req.file.originalname, req.file.mimetype);
    const mimeType = sanitizeMimeType(req.file.mimetype);

    const uploadResult = await uploadBufferToKommo({
      buffer: req.file.buffer,
      fileName,
      mimeType,
      driveUrl: normalizedDrive,
      accessToken: token
    });

    logger.info("Imagen subida a Kommo", {
      origin: "upload",
      driveUrl: normalizedDrive,
      sessionUuid: uploadResult.session?.uuid || null,
      kommoFileUuid: uploadResult.upload?.uuid || null,
      fileName,
      fileSize: req.file.buffer.length
    });

    res.json({
      success: true,
      source: {
        field: "image"
      },
      file: {
        name: fileName,
        size: req.file.buffer.length,
        mime_type: mimeType
      },
      kommo: formatKommoResponse(uploadResult)
    });
  } catch (error) {
    next(error);
  }
});

app.use((err, _req, res, _next) => {
  if (err instanceof ValidationError) {
    logger.warn("Solicitud invalida", { message: err.message });
    res.status(400).json({ message: err.message });
    return;
  }

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      logger.warn("Archivo supera el tamano permitido");
      res.status(413).json({ message: "El archivo excede el tamano maximo permitido" });
      return;
    }

    logger.warn("Error de carga", { code: err.code, message: err.message });
    res.status(400).json({ message: err.message });
    return;
  }

  if (err instanceof HttpError) {
    const status = err.status || 502;
    const details = err.details && Object.keys(err.details).length ? { details: err.details } : undefined;
    if (status >= 500) {
      logger.error(err.message, { status, details: err.details });
    } else {
      logger.warn(err.message, { status, details: err.details });
    }
    res.status(status).json({ message: err.message, ...(details || {}) });
    return;
  }

  if (err?.isAxiosError) {
    const status = err.response?.status || 502;
    logger.error("Error al contactar un servicio externo", {
      status,
      data: safeData(err.response?.data),
      message: err.message
    });
    res.status(status).json({
      message: "Error al contactar un servicio externo",
      status
    });
    return;
  }

  logger.error("Error inesperado", { message: err.message, stack: err.stack });
  res.status(500).json({ message: "Error interno del servidor" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Microservicio escuchando en el puerto ${PORT}`);
});

function uploadHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };
}

async function uploadBufferToKommo({ buffer, fileName, mimeType, driveUrl, accessToken }) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new ValidationError("El archivo a subir esta vacio");
  }

  const driveApiBase = driveUrl.replace(/\/+$/, "") + "/v1.0";

  let session;
  try {
    const sessionResponse = await axios.post(
      `${driveApiBase}/sessions`,
      {
        file_name: fileName,
        file_size: buffer.length,
        mime_type: mimeType,
        // Los campos name/size mantienen compatibilidad con sesiones previas de la API.
        name: fileName,
        size: buffer.length
      },
      {
        headers: uploadHeaders(accessToken),
        timeout: KOMMO_TIMEOUT_MS,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        validateStatus: (status) => status >= 200 && status < 300
      }
    );
    session = sessionResponse.data;
  } catch (error) {
    throw translateAxiosError(error, "No se pudo crear la sesion de carga en Kommo");
  }

  const uploadUrls = collectUploadUrls(session);
  if (!uploadUrls.length) {
    throw new HttpError(502, "Kommo no devolvio una URL de carga", safeData(session));
  }

  const maxPartSize = Math.max(1, toNumber(session.max_part_size, buffer.length));
  const maxFileSize = toNumber(session.max_file_size, Infinity);
  if (Number.isFinite(maxFileSize) && buffer.length > maxFileSize) {
    throw new ValidationError("El archivo excede el tamano maximo permitido por Kommo");
  }
  const totalParts = Math.max(1, Math.ceil(buffer.length / maxPartSize));
  let offset = 0;
  let partIndex = 0;
  let finalResponse = null;
  let currentUrl = uploadUrls.shift();

  while (offset < buffer.length) {
    if (!currentUrl) {
      throw new HttpError(502, "Kommo no devolvio URL para la siguiente parte", safeData(session));
    }

    const end = Math.min(offset + maxPartSize, buffer.length);
    const chunk = buffer.subarray(offset, end);

    const requestUrl = appendPartNumber(currentUrl, partIndex + 1, totalParts);
    finalResponse = await postChunkWithRetry({
      url: requestUrl,
      chunk,
      partNumber: partIndex + 1
    });

    const nextUrl = extractNextUploadUrl(finalResponse);
    currentUrl = nextUrl || uploadUrls.shift() || null;

    offset = end;
    partIndex += 1;
  }

  return {
    session,
    upload: finalResponse
  };
}

async function postChunkWithRetry({ url, chunk, partNumber }) {
  let attempt = 0;
  let lastError;
  while (attempt < KOMMO_MAX_RETRIES) {
    try {
      const response = await axios.post(url, chunk, {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Length": chunk.length
        },
        timeout: KOMMO_TIMEOUT_MS,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        validateStatus: (status) => status >= 200 && status < 300
      });
      return response.data;
    } catch (error) {
      lastError = error;
      logger.warn("Error al enviar chunk a Kommo, reintentando", {
        uploadUrl: url,
        partNumber,
        attempt: attempt + 1,
        message: error.message
      });
    }
    attempt += 1;
  }

  throw translateAxiosError(lastError, "No se pudo subir el archivo a Kommo");
}

function collectUploadUrls(session) {
  if (!session) {
    return [];
  }

  if (Array.isArray(session.upload_urls) && session.upload_urls.length) {
    return session.upload_urls;
  }

  if (typeof session.upload_url === "string" && session.upload_url.trim()) {
    return [session.upload_url.trim()];
  }

  return [];
}

function appendPartNumber(url, partNumber, totalParts) {
  if (!url || totalParts <= 1 || url.includes("part_num=")) {
    return url;
  }

  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}part_num=${partNumber}`;
}

function extractNextUploadUrl(responseData) {
  if (!responseData || typeof responseData !== "object") {
    return null;
  }

  if (typeof responseData.next_url === "string" && responseData.next_url.trim()) {
    return responseData.next_url.trim();
  }

  if (responseData.result && typeof responseData.result.next_url === "string" && responseData.result.next_url.trim()) {
    return responseData.result.next_url.trim();
  }

  return null;
}

async function fetchRemoteImage(imageUrl, overrideName) {
  let parsed;
  try {
    parsed = new URL(imageUrl);
  } catch (_error) {
    throw new ValidationError("image_url no es una URL valida");
  }

  let response;
  try {
    response = await axios.get(parsed.toString(), {
      responseType: "arraybuffer",
      timeout: REMOTE_FETCH_TIMEOUT_MS,
      maxRedirects: MAX_REDIRECTS,
      maxBodyLength: MAX_REMOTE_BYTES,
      maxContentLength: MAX_REMOTE_BYTES,
      validateStatus: (status) => status >= 200 && status < 300
    });
  } catch (error) {
    throw translateAxiosError(error, "No se pudo descargar la imagen proporcionada", 422);
  }

  const buffer = Buffer.from(response.data);
  if (!buffer.length) {
    throw new ValidationError("La imagen descargada esta vacia");
  }

  const mimeHeader = response.headers?.["content-type"];
  const contentDisposition = response.headers?.["content-disposition"];

  const mimeType = sanitizeMimeType(mimeHeader) || guessMimeFromName(parsed.pathname);
  const dispositionName = parseContentDisposition(contentDisposition);
  const nameFromUrl = path.basename(parsed.pathname);

  const fileName = buildFileName(overrideName || dispositionName || nameFromUrl, mimeType);

  if (buffer.length > MAX_REMOTE_BYTES) {
    throw new ValidationError("La imagen descargada excede el tamano maximo permitido");
  }

  return {
    buffer,
    mimeType,
    fileName
  };
}

function buildFileName(candidate, mimeType) {
  const fallback = "archivo";
  const sanitized = sanitizeFileName(candidate) || fallback;
  const hasExtension = Boolean(path.extname(sanitized));
  if (hasExtension) {
    return sanitized;
  }

  const extension = MIME_EXTENSION_MAP[mimeType] || MIME_EXTENSION_MAP[guessMimeFromName(sanitized)] || ".bin";
  return sanitized + extension;
}

function sanitizeFileName(name) {
  if (!name || typeof name !== "string") {
    return "";
  }
  const trimmed = name.trim();
  if (!trimmed) {
    return "";
  }
  return trimmed
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")
    .slice(0, 255);
}

function sanitizeMimeType(mimeType) {
  if (!mimeType || typeof mimeType !== "string") {
    return "application/octet-stream";
  }
  const clean = mimeType.split(";")[0].trim().toLowerCase();
  return clean || "application/octet-stream";
}

function parseContentDisposition(header) {
  if (!header || typeof header !== "string") {
    return null;
  }

  const starMatch = header.match(/filename\*\s*=\s*(?:[^']*''){0,1}([^;]+)/i);
  if (starMatch && starMatch[1]) {
    const value = starMatch[1].trim().replace(/^UTF-8''/i, "");
    try {
      return decodeURIComponent(value.replace(/"/g, ""));
    } catch (_error) {
      return value.replace(/"/g, "");
    }
  }

  const match = header.match(/filename\s*=\s*"?([^";]+)"?/i);
  if (match && match[1]) {
    return match[1].trim();
  }

  return null;
}

function guessMimeFromName(name) {
  if (!name) {
    return "application/octet-stream";
  }
  const extension = path.extname(name).toLowerCase();
  if (!extension) {
    return "application/octet-stream";
  }
  return EXTENSION_MIME_MAP[extension] || "application/octet-stream";
}

function normalizeDriveUrl(raw) {
  if (!raw || typeof raw !== "string") {
    throw new ValidationError("drive_url es requerido");
  }

  let trimmed = raw.trim();
  if (!trimmed) {
    throw new ValidationError("drive_url es requerido");
  }

  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = "https://" + trimmed;
  }

  trimmed = trimmed.replace(/\/+$/, "");
  trimmed = trimmed.replace(".amocrm.com", ".kommo.com");

  try {
    const url = new URL(trimmed);
    return url.origin + url.pathname.replace(/\/+$/, "");
  } catch (_error) {
    throw new ValidationError("drive_url no es valido");
  }
}

function ensureToken(token) {
  if (!token || typeof token !== "string") {
    throw new ValidationError("access_token es requerido");
  }
  const trimmed = token.trim();
  if (!trimmed) {
    throw new ValidationError("access_token es requerido");
  }
  return trimmed;
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return fallback;
}

function translateAxiosError(error, message, defaultStatus = 502) {
  if (!error) {
    return new HttpError(defaultStatus, message);
  }

  if (error instanceof HttpError) {
    return error;
  }

  const status = error.response?.status || defaultStatus;
  const data = safeData(error.response?.data);
  const details = {};
  if (status) {
    details.status = status;
  }
  if (data !== undefined) {
    details.data = data;
  }

  return new HttpError(status, message, details);
}

function safeData(data) {
  if (data === undefined || data === null) {
    return undefined;
  }
  if (typeof data === "string") {
    return data.slice(0, 500);
  }
  if (typeof data === "object") {
    try {
      return JSON.parse(JSON.stringify(data));
    } catch (_error) {
      return undefined;
    }
  }
  return undefined;
}

function formatKommoResponse(result) {
  const session = result.session || {};
  const upload = result.upload || {};

  return {
    session_uuid: session.uuid || null,
    file_uuid: upload.uuid || upload.id || null,
    max_part_size: session.max_part_size || null,
    session,
    upload
  };
}


