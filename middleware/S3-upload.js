const dotenv = require("dotenv");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

dotenv.config();

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function handleS3Upload(req, res) {
  {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const key = `${Date.now() + "-" + req.file.originalname}`;
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    });

    await s3Client.send(command);

    const fileName = key;
    const imageUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;

    res.status(200).json({ imageUrl });
  }
}

module.exports = { handleS3Upload };
