"use client";

import React, { useId, useRef, useState } from "react";
import { ASSIGNMENT_FILE_TYPES, MAX_ASSIGNMENT_FILE_BYTES, MAX_ASSIGNMENT_TEXT_CHARS, type PlanAssignment } from "./plan-types";

/**
 * Feature Owner: Divij Anand
 * Optional assignment input: upload a PDF/text file or paste the instructions.
 * The file is read in the browser and sent to our server, which passes it to Gemini.
 */

interface AssignmentInputProps {
  value: PlanAssignment;
  onChange: (value: PlanAssignment) => void;
  disabled?: boolean;
}

function mimeTypeFor(file: File): string | undefined {
  if (ASSIGNMENT_FILE_TYPES.includes(file.type)) return file.type;
  const ext = file.name.toLowerCase().split(".").pop();
  return ext === "pdf" ? "application/pdf" : ext === "md" ? "text/markdown" : ext === "txt" ? "text/plain" : undefined;
}

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AssignmentInput({ value, onChange, disabled }: AssignmentInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const textId = useId();
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);

  const handleFile = async (file?: File) => {
    setFileError(null);
    if (!file) return;
    const mimeType = mimeTypeFor(file);
    if (!mimeType) {
      setFileError("Please choose a PDF or a text file.");
      return;
    }
    if (file.size > MAX_ASSIGNMENT_FILE_BYTES) {
      setFileError("That file is larger than 4 MB. Try pasting the instructions instead.");
      return;
    }
    try {
      const data = await readAsBase64(file);
      setFileSize(file.size);
      onChange({ ...value, file: { name: file.name, mimeType, data } });
    } catch {
      setFileError("Couldn't read that file. Try another one or paste the text.");
    }
  };

  const removeFile = () => {
    setFileSize(null);
    if (inputRef.current) inputRef.current.value = "";
    onChange({ ...value, file: undefined });
  };

  return (
    <div className="space-y-3 max-w-2xl">
      <div>
        <p className="font-heading text-lg font-semibold text-[#F5F2FA]">Add the assignment</p>
        <p className="text-sm text-[#AAA5B4]">
          Optional, but it helps the plan match what your instructor asked for.
        </p>
      </div>

      {value.file ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#2A2E39] px-4 py-3">
          <span aria-hidden className="text-lg">📄</span>
          <span className="min-w-0 flex-1 truncate text-sm text-[#F5F2FA]">
            {value.file.name}
            {fileSize !== null && <span className="text-[#AAA5B4]"> · {formatSize(fileSize)}</span>}
          </span>
          <button
            type="button"
            onClick={removeFile}
            disabled={disabled}
            className="rounded-lg px-2 py-1 text-sm text-[#AAA5B4] hover:text-[#F5F2FA] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]/60 cursor-pointer"
          >
            Remove
          </button>
        </div>
      ) : (
        <div>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
            className="sr-only"
            id={`${textId}-file`}
            disabled={disabled}
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />
          <label
            htmlFor={`${textId}-file`}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-[#AAA5B4]/50 px-5 py-3 text-sm font-medium text-[#F5F2FA] hover:border-[#B8A6FF] focus-within:ring-2 focus-within:ring-[#B8A6FF]/60"
          >
            Upload PDF or text file
          </label>
        </div>
      )}
      {fileError && (
        <p role="alert" className="text-sm text-[#D5B45C]">
          {fileError}
        </p>
      )}

      <div className="space-y-1">
        <label htmlFor={textId} className="text-sm text-[#AAA5B4]">
          {value.file ? "Anything else to know? (optional)" : "Or paste the instructions"}
        </label>
        <textarea
          id={textId}
          value={value.text ?? ""}
          disabled={disabled}
          maxLength={MAX_ASSIGNMENT_TEXT_CHARS}
          rows={3}
          onChange={(e) => onChange({ ...value, text: e.target.value })}
          placeholder="e.g. 12-minute group presentation analyzing a film's cinematography. Proposal due Oct 6, presenting Oct 13."
          className="w-full rounded-xl border border-[#2A2E39] bg-[#171A23] px-4 py-3 text-[#F5F2FA] placeholder:text-[#AAA5B4]/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A6FF]/60"
        />
      </div>

      {/* 1-Click SFSU Assignment Presets */}
      <div className="space-y-1.5 pt-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#AAA5B4]">
          Quick SFSU Assignment Presets (1-Click Demo)
        </span>
        <div className="flex flex-wrap gap-2">
          {[
            {
              label: "CSC 648: Web App M2",
              icon: "🟣",
              text: "CSC 648 Group Web Application Milestone 2: Build frontend shell with Next.js and Tailwind, implement API endpoints for user sessions, develop scheduling overlap algorithm with automated tests, and prepare final slide deck for class demo. Due October 16, 2026.",
            },
            {
              label: "ENG 300: Rover System",
              icon: "🟡",
              text: "ENG 300 Autonomous Rover System: CAD modeling for chassis, sensor calibration circuit and microcontroller firmware, simulation verification in Gazebo, and technical design review document. Due November 10, 2026.",
            },
            {
              label: "BUS 690: Venture Pitch",
              icon: "🟢",
              text: "BUS 690 Strategic Venture Plan: Conduct competitive market analysis, build 3-year financial pro-forma projections, draft marketing go-to-market strategy, and assemble 10-slide investor pitch deck. Due October 28, 2026.",
            },
          ].map((preset) => (
            <button
              key={preset.label}
              type="button"
              disabled={disabled}
              onClick={() => onChange({ ...value, text: preset.text })}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#2A2E39] bg-[#1D202A] px-3 py-1.5 text-xs font-medium text-[#F5F2FA] hover:border-[#D5B45C] hover:bg-[#D5B45C]/10 transition active:scale-95 cursor-pointer"
            >
              <span>{preset.icon}</span>
              <span>{preset.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
