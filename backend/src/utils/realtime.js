module.exports = function emit(req, event, payload) {
  const io = req.app && req.app.get('io');
  if (io) io.emit(event, payload || {});
};
