const express = require("express");
const {
  registerUser,
  loginUser,
  getUserInfo,
} = require("../controllers/auth-controller");
const { handleS3Upload } = require("../middleware/S3-upload");
const { protect } = require("../middleware/auth");
const upload = require("../middleware/upload");

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/getUser", protect, getUserInfo);

router.post("/upload-image", upload.single("image"), handleS3Upload);

module.exports = router;
