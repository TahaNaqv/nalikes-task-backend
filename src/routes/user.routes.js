const router = require("express").Router();
const { register } = require("../controllers/user.controller");
const { validateRegister } = require("../middlewares/validation.middleware");

router.post("/register", validateRegister, register);

module.exports = router;
