"use client";

import { useEffect, useState, useRef } from "react";
import * as faceapi from "face-api.js";
import { useAuth } from "@/lib/AuthContext";
import { getFirestore, collection, addDoc, doc, getDoc } from "firebase/firestore";
import { detectBlink } from "./blink_detection";

interface FacialRecognitionProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  onScanComplete: (success: boolean) => void;
  userEmail: string | null;
}

export default function FacialRecognition({
  videoRef,
  canvasRef,
  onScanComplete,
  userEmail,
}: FacialRecognitionProps) {
  const { user } = useAuth();
  const [status, setStatus] = useState<
    "pending" | "ready" | "scanning" | "verified" | "unknown" | "error"
  >("pending");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const isMounted = useRef(true);

  const capturePhoto = (): string | null => {
    try {
      if (!videoRef.current || !canvasRef.current) return null;
      const context = canvasRef.current.getContext("2d") as CanvasRenderingContext2D;
      if (!context) return null;
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      context.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvasRef.current.toDataURL("image/jpeg", 0.5);
      return dataUrl.startsWith("data:image/jpeg;base64,") ? dataUrl : null;
    } catch (err) {
      console.error("FacialRecognition: Error capturing photo:", err);
      return null;
    }
  };

  const notify = async (imageDataUrl: string, email: string): Promise<void> => {
    try {
      if (!email || !imageDataUrl) throw new Error("Invalid email or image data");
      const db = getFirestore();
      const timestamp = new Date().toISOString();
      await addDoc(collection(db, "unknown_user_logs"), {
        userId: user?.uid,
        email,
        imageData: imageDataUrl,
        timestamp,
        emailSent: true,
        status: "unknown_user_detected",
      });
      const response = await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, imageDataUrl }),
      });
      if (!response.ok) throw new Error("Failed to send email");
    } catch (err) {
      console.error("FacialRecognition: Failed to save log or send email:", err);
      setErrorMessage("Failed to log unknown user or send email");
    }
  };

  useEffect(() => {
    if (!isMounted.current) return;
    const loadModels = async () => {
      const MODEL_URL = "/models";
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        setStatus("ready");
      } catch (err) {
        console.error("FacialRecognition: Failed to load models:", err);
        setStatus("error");
        setErrorMessage("Failed to load facial recognition models");
      }
    };

    if (user) loadModels();

    return () => {
      isMounted.current = false;
      setStatus("pending");
      setErrorMessage(null);
      setProgress(0);
    };
  }, [user]);

  const captureDetection = async (
    retries: number = 5
  ): Promise<faceapi.WithFaceDescriptor<
    faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }>
  > | null> => {
    if (!videoRef.current) return null;
    let attempts = 0;
    while (attempts < retries) {
      try {
        const detection = await faceapi
          .detectSingleFace(
            videoRef.current,
            new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.3 })
          )
          .withFaceLandmarks()
          .withFaceDescriptor();
        if (detection) {
          const box = detection.detection.box;
          const minFaceSize = 100;
          if (box.width < minFaceSize || box.height < minFaceSize) {
            setErrorMessage("Face is too small. Please move closer to the camera.");
            attempts++;
            await new Promise((resolve) => setTimeout(resolve, 100));
            continue;
          }
          console.log("FacialRecognition: Successfully captured detection");
          return detection;
        }
        attempts++;
        console.log(`FacialRecognition: No face detected, attempt ${attempts}/${retries}`);
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (err) {
        console.error("FacialRecognition: Face detection error:", err);
        attempts++;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    throw new Error("No face detected after retries");
  };

  const loadReferenceDescriptors = async () => {
    if (!user) throw new Error("User not authenticated");
    const descriptors: Float32Array[] = [];
    try {
      const db = getFirestore();
      const userRef = doc(db, "reference_images", user.uid);
      const docSnap = await getDoc(userRef);
      if (!docSnap.exists()) {
        throw new Error("No reference images found in Firestore");
      }
      const data = docSnap.data();
      const images: string[] = data.images || [];
      console.log(`FacialRecognition: Retrieved ${images.length} images from Firestore`);

      for (let i = 0; i < images.length; i++) {
        const dataUrl = images[i];
        if (!dataUrl) continue;
        const img = await faceapi.fetchImage(dataUrl);
        const detection = await faceapi
          .detectSingleFace(
            img,
            new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.3 })
          )
          .withFaceLandmarks()
          .withFaceDescriptor();
        if (detection) {
          descriptors.push(detection.descriptor);
          console.log(`FacialRecognition: Generated descriptor for image ${i + 1}`);
        } else {
          console.log(`FacialRecognition: Failed to generate descriptor for image ${i + 1}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
        if (!isMounted.current) {
          console.log("FacialRecognition: Component unmounted, stopping descriptor loading");
          return descriptors;
        }
      }
      if (descriptors.length < 3) {
        throw new Error(
          `Only ${descriptors.length} valid descriptors generated. Please re-upload at least 3 clear reference images.`
        );
      }
      console.log(`FacialRecognition: Loaded ${descriptors.length} descriptors`);
      return descriptors;
    } catch (err) {
      console.error("FacialRecognition: Error loading reference images:", err);
      throw err;
    }
  };

  const recognizeFace = async () => {
    try {
      setStatus("scanning");
      setErrorMessage("Preparing to scan... Please get ready to blink.");

      await new Promise((resolve) => setTimeout(resolve, 2000));

      setErrorMessage("Please blink to confirm liveness");

      let blinkDetected = false;
      const startTime = Date.now();
      const timeout = 50000;

      while (Date.now() - startTime < timeout) {
        if (!videoRef.current) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          continue;
        }

        console.log("FacialRecognition: Checking for blink...");
        const result = await detectBlink(videoRef.current, faceapi);

        if (result.blinkDetected) {
          blinkDetected = true;
          setErrorMessage("Blink detected! Verifying face...");
          setProgress(0);
          const progressInterval = setInterval(() => {
            setProgress((prev) => {
              if (prev >= 100) {
                clearInterval(progressInterval);
                return 100;
              }
              return prev + 2;
            });
          }, 50);
          break;
        }

        if (result.error) {
          setErrorMessage(result.error);
          setStatus("error");
          onScanComplete(false);
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      if (!blinkDetected) {
        setStatus("error");
        setErrorMessage("Spoofing alert: No live image found");
        onScanComplete(false);
        return;
      }

      const detection = await captureDetection();
      if (!detection) {
        setStatus("error");
        setErrorMessage("No face detected. Please ensure your face is visible.");
        setProgress(0);
        onScanComplete(false);
        return;
      }

      const liveDescriptor = detection.descriptor;
      const refDescriptors = await loadReferenceDescriptors();
      const labeledDescriptors = refDescriptors.map(
        (desc) => new faceapi.LabeledFaceDescriptors("user", [desc])
      );
      const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.6);
      const bestMatch = faceMatcher.findBestMatch(liveDescriptor);

      console.log(
        `FacialRecognition: Best match - Label: ${bestMatch.label}, Distance: ${bestMatch.distance}`
      );
      if (bestMatch.label === "user" && bestMatch.distance < 0.6) {
        setStatus("verified");
        setProgress(100);
        onScanComplete(true);
      } else {
        setStatus("unknown");
        setErrorMessage("Unknown user found");
        setProgress(0);
        const imageDataUrl = capturePhoto();
        if (imageDataUrl && userEmail) {
          await notify(imageDataUrl, userEmail);
        }
        onScanComplete(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setStatus("error");
      setErrorMessage(message);
      setProgress(0);
      onScanComplete(false);
    } finally {
      setStatus("ready");
    }
  };

  return (
    <div className="text-center">
      {status === "pending" && <p>Loading...</p>}
      {status === "ready" && (
        <button
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          onClick={recognizeFace}
        >
          Start Scanning
        </button>
      )}
      {status === "scanning" && (
        <div>
          <p>Scanning face... {errorMessage}</p>
          {progress > 0 && (
            <div className="mt-4 w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-50"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          )}
        </div>
      )}
      {status === "verified" && <p className="text-green-500">User Verified</p>}
      {status === "unknown" && (
        <p className="text-red-500">Error: {errorMessage}</p>
      )}
      {status === "error" && (
        <p className="text-red-500">Error: {errorMessage}</p>
      )}
    </div>
  );
}