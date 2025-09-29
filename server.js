const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const winston = require("winston");

const app = express();

// Ruta definitiva para guardar las imagenes publicas.
const UPLOAD_DIR = "/var/www/public/images";

// URL base que se utiliza para construir la respuesta publica.
let baseUrl = process.env.PUBLIC_BASE_URL || "https://tuservicio.com";
while (baseUrl.endsWith("/")) {
  baseUrl = baseUrl.slice(0, -1);
}
const PUBLIC_BASE_URL = baseUrl;

// Configurar logger con Winston
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// Configuracion del almacenamiento de Multer para apuntar al directorio deseado.
const storage = multer.diskStorage({
  destination: function destination(_req, _file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function filename(_req, file, cb) {
    const timestamp = Date.now();
    const randomSegment = Math.floor(Math.random() * 1e9);
    const originalExt = path.extname(file.originalname).toLowerCase();
    const baseName = path
      .basename(file.originalname, originalExt)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "archivo";

    const uniqueName = `${timestamp}-${randomSegment}-${baseName}${originalExt}`;
    cb(null, uniqueName);
  }
});

// Filtro para permitir solo archivos de imagen
const fileFilter = function (req, file, cb) {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'));
  }
};

const upload = multer({ storage: storage, fileFilter: fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

// Expone las imagenes subidas para que puedan consultarse directamente.
app.use("/images", express.static(UPLOAD_DIR));

// Health check endpoint
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Endpoint principal que recibe un archivo y devuelve la URL publica.
app.post("/upload", upload.single("image"), function handleUpload(req, res) {
  if (!req.file) {
    return res.status(400).json({ message: "No se recibio ningun archivo." });
  }

  const fileUrl = PUBLIC_BASE_URL + "/images/" + req.file.filename;
  return res.status(200).json({ url: fileUrl });
});

// Manejador global de errores para expedir respuestas controladas.
app.use(function errorHandler(err, _req, res, _next) {
  logger.error("Error durante la carga:", err);
  res.status(500).json({ message: "Error interno del servidor." });
});

// Arranca el servidor HTTP en el puerto 3000 por defecto.
const PORT = process.env.PORT || 3000;
app.listen(PORT, function onListen() {
  logger.info("Microservicio de subida escuchando en el puerto " + PORT);
});
