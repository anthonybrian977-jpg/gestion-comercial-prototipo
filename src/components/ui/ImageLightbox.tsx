"use client";

import { useEffect } from "react";

type ImageLightboxProps = {
  /** URL pública para mostrar. null = lightbox cerrado. */
  src: string | null;
  alt?: string;
  onClose: () => void;
};

/**
 * Lightbox de imagen reutilizable.
 * - Backdrop oscuro, cerrar con clic fuera o tecla Escape.
 * - z-[70] para aparecer por encima del modal de detalle (z-50).
 */
export function ImageLightbox({ src, alt = "", onClose }: ImageLightboxProps) {
  // Cerrar con Escape
  useEffect(() => {
    if (!src) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [src, onClose]);

  if (!src) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
      {/* Backdrop — cerrar al hacer clic fuera */}
      <button
        type="button"
        aria-label="Cerrar vista previa"
        className="absolute inset-0 bg-slate-900/80 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Contenedor de imagen */}
      <div className="relative z-10">
        {/* Botón X */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-slate-200 transition hover:bg-slate-100"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4 text-slate-600"
          >
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </button>

        {/* Imagen ampliada */}
        <img
          src={src}
          alt={alt}
          className="max-h-[85vh] max-w-[88vw] rounded-2xl object-contain shadow-2xl"
        />
      </div>
    </div>
  );
}
