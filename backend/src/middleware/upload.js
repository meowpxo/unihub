const multer = require('multer');
const path   = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
require('dotenv').config();

const UPLOAD_DIR = path.join(__dirname, '../../', process.env.UPLOAD_DIR || 'uploads/pdfs');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
}

const MAX_MB = parseInt(process.env.MAX_FILE_SIZE_MB) || 10;

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_MB * 1024 * 1024 },
});

module.exports = { upload, UPLOAD_DIR };
