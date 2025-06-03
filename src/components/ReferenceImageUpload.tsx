"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ScanFace, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { getFirestore, doc, setDoc, deleteDoc } from "firebase/firestore";
import * as faceapi from "face-api.js";

export default function ReferenceImageUpload() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isScanning, setIsScanning] = useState(false);
  const [imageCount, setImageCount] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [promptIndex, setPromptIndex] = useState(0);
  const [prompts] = useState([
    "Look straight at the camera.",
    "Turn your head slightly to the left.",
    "Turn your head slightly to the right.",
    "Tilt your head slightly up.",
    "Tilt your head slightly down.",
  ]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const framesToCapture = 5; // Moved to component scope

  const debouncedToast = useCallback(
    (options: {
      title: string;
      description: string;
      variant?: "default" | "destructive";
    }) => {
      toast(options);
    },
    [toast]
  );

  useEffect(() => {
    if (!authLoading && !user) {
      debouncedToast({
        title: "Authentication Required",
        description: "Please log in to upload reference images.",
        variant: "destructive",
      });
      router.push("/login");
    }
  }, [authLoading, user, router, debouncedToast]);

  useEffect(() => {
    const init = async () => {
      try {
        const MODEL_URL = "/models";
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 640, height: 480 },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          streamRef.current = stream;
        }
      } catch (error) {
        console.error("ReferenceImageUpload: Failed to initialize:", error);
        setCameraError("Failed to access camera. Please grant permissions.");
        debouncedToast({
          title: "Camera Error",
          description: "Failed to access camera. Please check permissions.",
          variant: "destructive",
        });
      }
    };

    if (!authLoading && user) {
      init();
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }
    };
  }, [authLoading, user, debouncedToast]);

  const logUploadAttempt = async (success: boolean, capturedFrames: number) => {
    if (!user) return;
    try {
      const db = getFirestore();
      await setDoc(doc(db, "reference_upload_logs", `${user.uid}_${Date.now()}`), {
        userId: user.uid,
        email: user.email,
        timestamp: new Date().toISOString(),
        success,
        capturedFrames,
        device: navigator.userAgent,
      });
    } catch (err) {
      console.error("ReferenceImageUpload: Failed to log upload attempt:", err);
    }
  };

  const clearExistingImages = async () => {
    if (!user) return;
    try {
      const db = getFirestore();
      const userRef = doc(db, "reference_images", user.uid);
      await deleteDoc(userRef);
      setImageCount(0);
      console.log("Cleared existing images for user:", user.uid);
    } catch (err) {
      console.error("ReferenceImageUpload: Failed to clear existing images:", err);
    }
  };

  const captureImage = async () => {
    if (!canvasRef.current || !videoRef.current) return null;

    const context = canvasRef.current.getContext("2d");
    if (!context) return null;

    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    context.drawImage(
      videoRef.current,
      0,
      0,
      canvasRef.current.width,
      canvasRef.current.height
    );
    const imageData = canvasRef.current.toDataURL("image/jpeg", 0.5); // Increased compression

    const img = new Image();
    img.src = imageData;
    await new Promise((resolve) => (img.onload = resolve));

    const detection = await faceapi
      .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.3 }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      console.log("ReferenceImageUpload: No face detected in captured image");
      debouncedToast({
        title: "No Face Detected",
        description: "Please ensure your face is clearly visible.",
        variant: "destructive",
      });
      return null;
    }

    const box = detection.detection.box;
    const minFaceSize = 100;
    if (box.width < minFaceSize || box.height < minFaceSize) {
      console.log("ReferenceImageUpload: Face too small in captured image");
      debouncedToast({
        title: "Image Quality Issue",
        description: "Face is too small. Please move closer to the camera.",
        variant: "destructive",
      });
      return null;
    }

    const imageSizeBytes = Math.round((imageData.length * 3) / 4); // Approximate size in bytes
    console.log(`ReferenceImageUpload: Captured image size: ${imageSizeBytes} bytes`);
    return { imageData, descriptor: detection.descriptor, size: imageSizeBytes };
  };

  const estimateDocumentSize = (images: string[]) => {
    const data = { images, updatedAt: new Date().toISOString() };
    const jsonString = JSON.stringify(data);
    const sizeBytes = new TextEncoder().encode(jsonString).length;
    return sizeBytes;
  };

  const handleStartScanning = async () => {
    if (!user || !videoRef.current || cameraError) {
      debouncedToast({
        title: "Error",
        description: "Camera not ready or user not authenticated.",
        variant: "destructive",
      });
      return;
    }

    await clearExistingImages();
    setIsScanning(true);
    setPromptIndex(0);
    setProgressMessage(prompts[0]);

    try {
      const db = getFirestore();
      const userRef = doc(db, "reference_images", user.uid);
      const images: string[] = [];
      let capturedFrames = 0;
      const totalDuration = 20 * 1000; // 20 seconds
      const intervalTime = totalDuration / framesToCapture;
      const maxDocumentSize = 1_000_000; // Slightly below 1 MB to be safe

      await new Promise<void>((resolve) => {
        scanIntervalRef.current = setInterval(async () => {
          if (capturedFrames >= framesToCapture || !videoRef.current) {
            clearInterval(scanIntervalRef.current!);
            resolve();
            return;
          }

          setProgressMessage(prompts[capturedFrames % prompts.length]);
          const result = await captureImage();

          if (result) {
            images.push(result.imageData);
            capturedFrames++;
            console.log(`ReferenceImageUpload: Captured image ${capturedFrames}, size: ${result.size} bytes`);
          } else {
            console.log(`ReferenceImageUpload: Failed to capture image at frame ${capturedFrames + 1}`);
          }
          setPromptIndex(capturedFrames % prompts.length);
          setImageCount(capturedFrames);
        }, intervalTime);
      });

      const documentSize = estimateDocumentSize(images);
      console.log(`ReferenceImageUpload: Estimated document size: ${documentSize} bytes`);

      if (documentSize > maxDocumentSize) {
        debouncedToast({
          title: "Error",
          description: "Captured images exceed Firestore size limit. Try again with fewer images.",
          variant: "destructive",
        });
        await logUploadAttempt(false, capturedFrames);
        return;
      }

      if (images.length >= 3) {
        await setDoc(userRef, { images, updatedAt: new Date().toISOString() });
        setImageCount(capturedFrames);
        debouncedToast({
          title: "Success",
          description: `${capturedFrames} images saved for recognition.`,
        });
        await logUploadAttempt(true, capturedFrames);
      } else {
        debouncedToast({
          title: "Error",
          description: `Only ${images.length} valid images captured. At least 3 are required.`,
          variant: "destructive",
        });
        await logUploadAttempt(false, capturedFrames);
      }
    } catch (error: any) {
      console.error("ReferenceImageUpload: Error during scanning:", error);
      debouncedToast({
        title: "Error",
        description: error.message || "Failed to capture or save images.",
        variant: "destructive",
      });
      await logUploadAttempt(false, imageCount);
    } finally {
      setIsScanning(false);
      setProgressMessage("");
    }
  };

  if (authLoading) {
    return (
      <div className="container mx-auto px-4 py-8 flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Upload Reference Images</CardTitle>
          <CardDescription>
            Follow the prompts for about 20 seconds to capture 5 reference images.
            Ensure good lighting and follow the instructions for best results.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {cameraError ? (
            <div className="w-full max-w-md mx-auto p-4 bg-red-100 border border-red-400 rounded-md flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <p className="text-red-600">{cameraError}</p>
            </div>
          ) : (
            <div className="relative w-full max-w-md mx-auto">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full rounded-md border"
                style={{ aspectRatio: "4/3" }}
              />
              {isScanning && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-md">
                  <p className="text-white font-semibold">{progressMessage}</p>
                </div>
              )}
            </div>
          )}
          <canvas ref={canvasRef} className="hidden" />
          <div className="text-center">
            <p>Images Captured: {imageCount}/{framesToCapture}</p>
            <Button
              onClick={handleStartScanning}
              disabled={isScanning || !!cameraError || !user}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
            >
              {isScanning ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ScanFace className="mr-2 h-4 w-4" />
              )}
              Start Scanning (20 Seconds)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}