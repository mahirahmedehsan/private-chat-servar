import rateLimit from 'express-rate-limit'

export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 200,
  message: { error: { message: 'Too many requests, please try again later' } },
  standardHeaders: true,
  legacyHeaders: false,
})

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: { message: 'Too many authentication attempts' } },
  standardHeaders: true,
  legacyHeaders: false,
})
