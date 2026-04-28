export function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

export function sendCreated(res, data) {
  res.status(201).json(data);
}
