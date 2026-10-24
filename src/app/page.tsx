"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Swal from "sweetalert2";

const swalBase = {
  buttonsStyling: false,
  customClass: {
    popup: "!w-[calc(100%-2rem)] !max-w-md !rounded-2xl",
    title: "!text-slate-900",
    htmlContainer: "!text-slate-600",
    confirmButton:
      "rounded-lg bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2",
    cancelButton:
      "rounded-lg bg-slate-200 px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2",
  },
  showClass: { popup: "swal2-show" },
  hideClass: { popup: "swal2-hide" },
};

interface UploadedImage {
  id: number | string;
  image_url: string;
}

function isUploadedImage(value: unknown): value is UploadedImage {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    (typeof value.id === "number" || typeof value.id === "string") &&
    "image_url" in value &&
    typeof value.image_url === "string"
  );
}

function getErrorMessage(value: unknown, fallback: string) {
  if (typeof value !== "object" || value === null) return fallback;

  if ("error" in value && typeof value.error === "string") return value.error;
  if ("message" in value && typeof value.message === "string") {
    return value.message;
  }

  return fallback;
}

export default function Home() {
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [loadingImages, setLoadingImages] = useState(true);
  const [imagesError, setImagesError] = useState<string | null>(null);
  const [deletingImageId, setDeletingImageId] = useState<
    UploadedImage["id"] | null
  >(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchImages = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch("/api/images", { signal });
    const result: unknown = await response.json();

    if (!response.ok) {
      throw new Error(getErrorMessage(result, "Could not load images."));
    }

    if (
      typeof result !== "object" ||
      result === null ||
      !("success" in result) ||
      result.success !== true ||
      !("images" in result) ||
      !Array.isArray(result.images) ||
      !result.images.every(isUploadedImage)
    ) {
      throw new Error(getErrorMessage(result, "Invalid image list received."));
    }

    return result.images;
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    void fetchImages(controller.signal)
      .then((loadedImages) => {
        if (controller.signal.aborted) return;
        setImages(loadedImages);
        setImagesError(null);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setImagesError(
          error instanceof Error ? error.message : "Could not load images."
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingImages(false);
      });

    return () => controller.abort();
  }, [fetchImages]);

  useEffect(
    () => () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    },
    []
  );

  const handleImageChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!["image/jpeg", "image/png"].includes(file.type)) {
      void Swal.fire({
        ...swalBase,
        icon: "error",
        title: "Invalid Image",
        text: "Please select a JPG or PNG image.",
        confirmButtonText: "OK",
      });
      return;
    }

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }

    const previewUrl = URL.createObjectURL(file);
    previewUrlRef.current = previewUrl;
    setImage(file);
    setPreview(previewUrl);
  };

  const handleUpload = async () => {
    if (!image) return;

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("image", image);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const result: unknown = await response.json();

      if (!response.ok) {
        throw new Error(getErrorMessage(result, "Upload failed"));
      }

      setLoadingImages(true);
      setImagesError(null);
      try {
        setImages(await fetchImages());
      } catch (error) {
        setImagesError(
          error instanceof Error ? error.message : "Could not load images."
        );
      } finally {
        setLoadingImages(false);
      }
      const successPopup = Swal.fire({
        ...swalBase,
        icon: "success",
        title: "Upload Successful!",
        text: "Your image has been uploaded successfully.",
        confirmButtonText: "OK",
      });

      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
      setImage(null);
      setPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";

      await successPopup;
    } catch {
      await Swal.fire({
        ...swalBase,
        icon: "error",
        title: "Upload Failed",
        text: "We couldn't upload your image. Please try again.",
        confirmButtonText: "OK",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (uploadedImage: UploadedImage) => {
    const confirmation = await Swal.fire({
      ...swalBase,
      icon: "warning",
      title: "Delete Image?",
      text: "Are you sure you want to delete this image? This action cannot be undone.",
      showCancelButton: true,
      confirmButtonText: "Yes, Delete",
      cancelButtonText: "Cancel",
      customClass: {
        ...swalBase.customClass,
        actions: "delete-confirm-actions",
        confirmButton: "delete-confirm-button",
        cancelButton: "delete-cancel-button",
      },
    });

    if (!confirmation.isConfirmed) return;

    setDeletingImageId(uploadedImage.id);
    setDeleteError(null);

    try {
      const response = await fetch(
        `/api/images/${encodeURIComponent(uploadedImage.id)}`,
        { method: "DELETE" }
      );
      const result: unknown = await response.json();

      if (!response.ok) {
        throw new Error(getErrorMessage(result, "Could not delete image."));
      }

      setImages((currentImages) =>
        currentImages.filter((image) => image.id !== uploadedImage.id)
      );
      await Swal.fire({
        ...swalBase,
        icon: "success",
        title: "Image Deleted!",
        text: "The image has been removed successfully.",
        showConfirmButton: false,
        timer: 2000,
      });
    } catch {
      const errorMessage = "We couldn't delete this image. Please try again.";
      setDeleteError(errorMessage);
      await Swal.fire({
        ...swalBase,
        icon: "error",
        title: "Delete Failed",
        text: errorMessage,
        confirmButtonText: "OK",
      });
    } finally {
      setDeletingImageId(null);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">
            Your collection
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Uploaded Images
          </h1>
          <p className="mt-2 text-slate-600">
            Upload and browse your image library.
          </p>
        </header>

        <section
          aria-labelledby="upload-heading"
          className="mb-10 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8"
        >
          <h2 id="upload-heading" className="mb-6 text-xl font-semibold">
            Upload an image
          </h2>

          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Select an image
            </label>

            <div className="flex flex-wrap items-center gap-4">
              <label
                htmlFor="image-upload"
                className="cursor-pointer rounded-lg border border-blue-600 bg-blue-50 px-5 py-3 font-medium text-blue-700 transition hover:bg-blue-100"
              >
                Choose Image
              </label>

              <input
                ref={fileInputRef}
                id="image-upload"
                type="file"
                accept="image/jpeg,image/png"
                onChange={handleImageChange}
                className="sr-only"
              />

              <span className="text-sm text-slate-500">
                {image ? image.name : "No image selected"}
              </span>
            </div>

            <p className="mt-2 text-xs text-slate-500">
              Supported formats: JPG, PNG (Max 5 MB)
            </p>
          </div>

          {preview && (
            <Image
              src={preview}
              alt="Selected image preview"
              width={400}
              height={300}
              unoptimized
              className="mb-5 max-h-72 rounded-lg object-contain"
            />
          )}

          <button
            onClick={handleUpload}
            disabled={!image || uploading}
            className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Upload Image"}
          </button>
        </section>

        <section aria-labelledby="gallery-heading">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h2 id="gallery-heading" className="text-2xl font-bold">
                Gallery
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {images.length} {images.length === 1 ? "image" : "images"}
              </p>
            </div>
          </div>

          {loadingImages ? (
            <p role="status" className="rounded-xl bg-white p-6 text-slate-600 shadow-sm">
              Loading images...
            </p>
          ) : imagesError ? (
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700"
            >
              {imagesError}
            </p>
          ) : images.length === 0 ? (
            <p className="rounded-xl bg-white p-6 text-slate-600 shadow-sm">
              No images uploaded yet
            </p>
          ) : (
            <>
              {deleteError && (
                <p
                  role="alert"
                  className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700"
                >
                  {deleteError}
                </p>
              )}
              <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {images.map((uploadedImage) => {
                  const isDeleting = deletingImageId === uploadedImage.id;

                  return (
                    <li
                      key={uploadedImage.id}
                      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <div className="relative aspect-[4/3] bg-slate-100">
                        <Image
                          src={uploadedImage.image_url}
                          alt={`Uploaded image ${uploadedImage.id}`}
                          fill
                          unoptimized
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                          className="object-cover"
                        />
                        <button
                          type="button"
                          title="Delete Image"
                          aria-label={`Delete image ${uploadedImage.id}`}
                          aria-busy={isDeleting}
                          disabled={deletingImageId !== null}
                          onClick={() => void handleDelete(uploadedImage)}
                          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-lg font-semibold leading-none text-white shadow transition hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isDeleting ? "…" : "×"}
                        </button>
                      </div>
                      <div className="px-4 py-3">
                        <p className="text-sm font-medium text-slate-700">
                          Image ID: {uploadedImage.id}
                        </p>
                        {isDeleting && (
                          <p role="status" className="mt-1 text-xs text-slate-500">
                            Deleting image...
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      </div>
    </main>
  );
}