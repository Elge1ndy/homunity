module.exports = function can(permission) {
  return function (req, res, next) {
    const perms = (req.user && req.user.permissions) || {};
    if (perms[permission] === false) return res.status(403).json({ message: 'لا تملك صلاحية لهذا الإجراء' });
    next();
  };
};
