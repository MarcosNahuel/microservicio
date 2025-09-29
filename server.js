const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();

// Ruta definitiva para guardar las imagenes publicas.
const UPLOAD_DIR = "/var/www/public/images";
// Crea el directorio de destino si aun no existe.
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// URL base que se utiliza para construir la respuesta publica.
let baseUrl = process.env.PUBLIC_BASE_URL || "https://tuservicio.com";
while (baseUrl.endsWith("/")) {
  baseUrl = baseUrl.slice(0, -1);
}
const PUBLIC_BASE_URL = baseUrl;

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

const upload = multer({ storage: storage });

// Expone las imagenes subidas para que puedan consultarse directamente.
app.use("/images", express.static(UPLOAD_DIR));

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
  console.error("Error durante la carga:", err);
  res.status(500).json({ message: "Error interno del servidor." });
});

// Arranca el servidor HTTP en el puerto 3000 por defecto.
const PORT = process.env.PORT || 3000;
app.listen(PORT, function onListen() {
  console.log("Microservicio de subida escuchando en el puerto " + PORT);
});
