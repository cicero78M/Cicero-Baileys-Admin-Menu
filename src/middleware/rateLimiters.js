import rateLimit from 'express-rate-limit';

function buildLimiter({ windowMs, limit, message }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message },
  });
}

export const authLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: 'Terlalu banyak percobaan autentikasi. Coba lagi beberapa saat lagi.',
});

export const claimLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: 'Terlalu banyak permintaan verifikasi. Coba lagi beberapa saat lagi.',
});
