require("colors");
const dotenv = require("dotenv");
dotenv.config();

const { v4: uuidv4 } = require("uuid");
const sharp = require("sharp");
const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/ApiError");

const { initializeApp } = require("firebase/app");
const {
  getStorage,
  ref,
  getDownloadURL,
  uploadBytesResumable,
  deleteObject
} = require("firebase/storage");
const capitalizeFirstLetter = require("../utils/capitalizeFirstLetter");
const splitCamelCase = require("../utils/splitCamelCase");

const config = {
  apiKey: process.env.API_KEY,
  authDomain: process.env.AUTH_DOMAIN,
  projectId: process.env.PROJECT_ID,
  storageBucket: process.env.STORAGE_BUCKET,
  messagingSenderId: process.env.MESSAGE_SENDER_ID,
  appId: process.env.APP_ID,
  measurementId: process.env.MEASUREMENT_ID
};

initializeApp(config);

const storage = getStorage();

// constants
const DEFAULT_FOLDERNAME = "images";
const DEFAULT_STARTINDEX = "image";

const uploadImageAndGetUrl = async (
  image,
  folderName = DEFAULT_FOLDERNAME,
  startIndex = DEFAULT_STARTINDEX,
  fullQuality = false
) => {
  try {
    // Downgrade image quality
    const processedImageBuffer = await sharp(image.buffer)
      .toFormat("png")
      .png({ quality: fullQuality ? 100 : 80 })
      .toBuffer();
    // Upload image
    const storageRef = ref(
      storage,
      `${folderName}/${`${startIndex}-${uuidv4()}-${Date.now()}.png`}`
    );
    const metadata = { contentType: "image/png" };
    // Add image download URL to request body
    const snapshot = await uploadBytesResumable(
      storageRef,
      processedImageBuffer,
      metadata
    );
    return await getDownloadURL(snapshot.ref);
  } catch (error) {
    console.log("🚀 ~ error uploading image:".red, error);
    return;
  }
};

const uploadAudioAndGetUrl = async (
  audio,
  folderName = DEFAULT_FOLDERNAME,
  startIndex = DEFAULT_STARTINDEX
) => {
  try {
    // Upload audio directly without processing
    const storageRef = ref(
      storage,
      `${folderName}/${`${startIndex}-${uuidv4()}-${Date.now()}-${
        audio.originalname
      }`}`
    );
    const metadata = { contentType: audio.mimetype };
    // Add audio download URL to request body
    const snapshot = await uploadBytesResumable(
      storageRef,
      audio.buffer,
      metadata
    );
    return await getDownloadURL(snapshot.ref);
  } catch (error) {
    console.log("🚀 ~ error uploading audio:".red, error);
    return;
  }
};

const deleteFileByUrl = async (
  fileUrl,
  folderName = DEFAULT_FOLDERNAME,
  startIndex = DEFAULT_STARTINDEX
) => {
  try {
    const fullPath = new URL(fileUrl).pathname;
    const startInd = fullPath.indexOf(`${startIndex}-`);
    const fileName = fullPath.substring(startInd);
    const storageRef = ref(storage, `${folderName}/${fileName}`);
    return await deleteObject(storageRef);
  } catch (error) {
    console.log("🚀 ~ error:", error);
    return;
  }
};

class FirebaseImageController {
  // Upload/Delete image to Firebase
  static uploadImage = asyncHandler(
    async (
      req,
      modelName = DEFAULT_STARTINDEX,
      imageKeyName = "image",
      required = false,
      multiple = false,
      fullQuality = false
    ) => {
      const files = req.files || [];
      const targetFiles = files.filter((f) => f.fieldname === imageKeyName);
      // Check if images are required and not provided
      if (required && targetFiles.length === 0)
        throw new ApiError(
          `${capitalizeFirstLetter(splitCamelCase(imageKeyName))} is required`,
          400
        );
      // Validate file types
      const allowedMimeTypes = [
        "image/jpg",
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "application/octet-stream"
      ];
      targetFiles.forEach((file) => {
        if (!allowedMimeTypes.includes(file.mimetype)) {
          throw new ApiError(
            `${file.originalname} is not a valid image file`,
            400
          );
        }
      });
      // Handle single or multiple file uploads
      if (multiple) {
        if (targetFiles.length === 0 && required) {
          throw new ApiError(
            `At least one ${capitalizeFirstLetter(
              splitCamelCase(imageKeyName)
            )} is required`,
            400
          );
        } else if (targetFiles.length === 0) {
          return;
        }
        // Upload multiple images
        req.body[imageKeyName] = await Promise.all(
          targetFiles.map((file) =>
            uploadImageAndGetUrl(file, modelName, modelName, fullQuality)
          )
        );
      } else {
        const targetFile = targetFiles[0];
        if (!targetFile) {
          if (required) {
            throw new ApiError(
              `${capitalizeFirstLetter(
                splitCamelCase(imageKeyName)
              )} is required`,
              400
            );
          }
          return;
        }
        // Upload single image
        req.body[imageKeyName] = await uploadImageAndGetUrl(
          targetFile,
          modelName,
          modelName,
          fullQuality
        );
      }
    }
  );

  // Upload/Delete audio to Firebase
  static uploadAudio = asyncHandler(
    async (
      req,
      modelName = DEFAULT_STARTINDEX,
      audioKeyName = "audio",
      required = false
    ) => {
      const files = req.files || [];
      const targetFiles = files.filter((f) => f.fieldname === audioKeyName);
      // Check if audio files are required and not provided
      if (required && targetFiles.length === 0)
        throw new ApiError(
          `${capitalizeFirstLetter(splitCamelCase(audioKeyName))} is required`,
          400
        );
      // Validate file types
      const allowedMimeTypes = [
        "audio/mpeg", // .mp3
        "audio/wav", // .wav
        "audio/ogg", // .ogg
        "audio/m4a", // .m4a
        "audio/x-m4a", // alternative m4a
        "audio/aac", // .aac
        "application/octet-stream"
      ];
      targetFiles.forEach((file) => {
        if (!allowedMimeTypes.includes(file.mimetype)) {
          console.log(
            "🚀 ~ FirebaseImageController ~ targetFiles.forEach ~ file.mimetype:",
            file.mimetype
          );
          throw new ApiError(
            `${file.originalname} is not a valid audio file`,
            400
          );
        }
      });
      // Handle audio uploads
      const targetFile = targetFiles[0];
      if (!targetFile) {
        if (required) {
          throw new ApiError(
            `${capitalizeFirstLetter(
              splitCamelCase(audioKeyName)
            )} is required`,
            400
          );
        }
        return;
      }
      // Get audio duration using audio-duration package
      const duration = await new Promise((resolve, reject) => {
        const audioContext = new (require("web-audio-api").AudioContext)();
        audioContext.decodeAudioData(
          targetFile.buffer,
          (buffer) => {
            resolve(buffer.duration);
          },
          (err) => {
            reject(new Error("Error getting audio duration: " + err.message));
          }
        );
      });
      // Set both URL and duration in request body
      req.body[audioKeyName] = await uploadAudioAndGetUrl(
        targetFile,
        modelName,
        modelName
      );
      req.body.duration = Math.round(duration);
    }
  );

  static deleteFile = asyncHandler(
    async (link, modelName = DEFAULT_STARTINDEX) => {
      if (!link) return;
      await deleteFileByUrl(link, modelName, modelName);
    }
  );
}

module.exports = FirebaseImageController;
