import Joi from 'joi'

export function validate(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false })
    if (error) {
      const messages = error.details.map((d) => d.message)
      return res.status(400).json({ error: { message: 'Validation failed', details: messages } })
    }
    next()
  }
}

export const schemas = {
  register: Joi.object({
    idToken: Joi.string().required(),
    name: Joi.string().min(2).max(50).required(),
  }),

  login: Joi.object({
    idToken: Joi.string().required(),
  }),

  friendRequest: Joi.object({
    userId: Joi.string().required(),
  }),

  friendResponse: Joi.object({
    requestId: Joi.string().required(),
    action: Joi.string().valid('accept', 'reject').required(),
  }),
}
