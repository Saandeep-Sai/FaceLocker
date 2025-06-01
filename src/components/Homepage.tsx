"use client";
import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Lock, MessageSquare, Star, Camera, AlertTriangle } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2 } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface UserData {
  name?: string;
  email: string;
  emailVerified: boolean;
}

export default function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [userName, setUserName] = useState<string | null>(null);
  const [isDataLoading, setIsDataLoading] = useState(true);

  const justActivated = searchParams
    ? searchParams.get("justActivated") === "true"
    : false;

  const retryGetDoc = async (docRef: any, retries = 3, delay = 500) => {
    for (let i = 0; i < retries; i++) {
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) return docSnap;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    throw new Error("User data not found");
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to access this page.",
        variant: "destructive",
      });
      router.push("/login");
      return;
    }
    const fetchUserData = async () => {
      try {
        const userDoc = await retryGetDoc(doc(db, "users", user.uid));
        console.log("User data fetched successfully:", userDoc.data());
        const data = userDoc.data() as UserData;
        setUserName(data.name || user.displayName || "User");
        if (!data.emailVerified && !justActivated) {
          sessionStorage.setItem("activationEmail", data.email);
          toast({
            title: "Email Not Verified",
            description: "Please verify your email to access this page.",
            variant: "destructive",
          });
          router.push("/activate");
        } else {
          sessionStorage.removeItem("activationEmail");
        }
      } catch (error: any) {
        toast({
          title: "Error",
          description: "Failed to load user data.",
          variant: "destructive",
        });
        router.push("/register");
      } finally {
        setIsDataLoading(false);
      }
    };
    fetchUserData();
  }, [user, authLoading, router, justActivated, toast]);

  const getInitials = (name: string | null) => {
    if (!name) return "U";
    const names = name.trim().split(" ");
    return names.length === 1
      ? names[0][0].toUpperCase()
      : `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
  };

  const features = [
    {
      title: "Access Your Locker",
      description: "Securely access your stored items using face and password.",
      icon: <Lock className="h-8 w-8 text-primary" />,
      action: () => router.push("/locker"),
      buttonText: "Unlock Locker",
    },
    {
      title: "Upload Reference Images",
      description: "Upload reference images for facial recognition.",
      icon: <Camera className="h-8 w-8 text-primary" />,
      action: () => router.push("/reference-upload"),
      buttonText: "Upload Images",
    },
    {
      title: "Post a Review",
      description: "Share your experience with FaceLocker.",
      icon: <MessageSquare className="h-8 w-8 text-primary" />,
      action: () => router.push("/reviews/post"),
      buttonText: "Write a Review",
    },
    {
      title: "View Reviews",
      description: "See what others are saying about FaceLocker.",
      icon: <Star className="h-8 w-8 text-primary" />,
      action: () => router.push("/reviews/view"),
      buttonText: "Read Reviews",
    },
    {
      title: "View Unknown User Logs",
      description: "Review logs of unauthorized access attempts to your locker.",
      icon: <AlertTriangle className="h-8 w-8 text-primary" />,
      action: () => router.push("/unknown-logs"),
      buttonText: "View Unknown Logs",
    },
  ];

  if (authLoading || isDataLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <main className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
        <div className="max-w-7xl mx-auto space-y-10">
          <Card className="shadow-xl rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-6">
              <Avatar>
                <AvatarImage
                  src={user?.photoURL || "/images/Avatar.png"}
                  alt={userName || "User"}
                />
                <AvatarFallback>{getInitials(userName)}</AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  Welcome, {userName}
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-300 mt-1">
                  You're logged in as {user?.email}. Manage your security,
                  access your locker, and share your feedback.
                </CardDescription>
              </div>
            </CardHeader>
          </Card>

          <section className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <Card
                key={feature.title}
                className={`flex flex-col justify-between bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 transition hover:shadow-xl hover:-translate-y-1 ${
                  index === 0 ? 'col-span-full' : ''
                }`}
              >
                <CardHeader className="flex flex-row items-start gap-4 p-4">
                  <div className="bg-primary/10 p-3 rounded-full">
                    {feature.icon}
                  </div>
                  <div>
                    <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {feature.title}
                    </CardTitle>
                    <CardDescription className="text-gray-600 dark:text-gray-300 mt-1">
                      {feature.description}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardFooter className="p-4">
                  <Button
                    onClick={feature.action}
                    className="w-full bg-primary text-white hover:bg-primary/90 transition"
                  >
                    {feature.buttonText}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </section>
        </div>
      </main>
    </>
  );
}