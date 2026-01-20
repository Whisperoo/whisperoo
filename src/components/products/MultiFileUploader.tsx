import React, { useState, useCallback } from "react";
import {
  Upload,
  X,
  File,
  Video,
  Image,
  FileText,
  Music,
  Loader2,
  ChevronUp,
  ChevronDown,
  Star,
  Edit2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  validateFile,
  getCurrentLimits,
  getAllAcceptedTypes,
  formatFileSize,
} from "@/config/upload";
import { useUploadNotifications } from "@/hooks/use-upload-notifications";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface FileWithPreview {
  file: File;
  id: string;
  preview?: string;
  progress?: number;
  error?: string;
  isPrimary?: boolean;
  displayTitle?: string;
}

export interface FileWithTitle {
  file: File;
  displayTitle: string;
}

interface MultiFileUploaderProps {
  onFilesChange: (files: FileWithTitle[]) => void;
  maxFiles?: number;
  maxSizePerFile?: number; // in MB
  acceptedFileTypes?: string[];
  className?: string;
  existingFilesCount?: number; // Number of files already uploaded
  hasPrimaryFile?: boolean; // Whether a primary file already exists
}

// Sortable File Item Component
interface SortableFileItemProps {
  fileItem: FileWithPreview;
  index: number;
  files: FileWithPreview[];
  getFileIcon: (file: File) => JSX.Element;
  getFileTypeColor: (file: File) => string;
  updateFileTitle: (fileId: string, title: string) => void;
  removeFile: (id: string) => void;
  moveFile: (index: number, direction: "up" | "down") => void;
  setPrimaryFile: (id: string) => void;
  hasPrimaryFile: boolean;
  formatFileSizeLocal: (bytes: number) => string;
}

const SortableFileItem: React.FC<SortableFileItemProps> = ({
  fileItem,
  index,
  files,
  getFileIcon,
  getFileTypeColor,
  updateFileTitle,
  removeFile,
  moveFile,
  setPrimaryFile,
  hasPrimaryFile,
  formatFileSizeLocal,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: fileItem.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: "move" as const,
  };

  return (
    <div ref={setNodeRef} style={style} className="mb-2">
      <Card className="overflow-hidden">
        <CardContent className="p-3">
          <div className="flex items-center space-x-3">
            {/* Drag handle */}
            <div
              className="flex-shrink-0 cursor-move p-2 hover:bg-gray-100 rounded transition-colors"
              {...attributes}
              {...listeners}
            >
              <svg
                className="w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 8h16M4 16h16"
                />
              </svg>
            </div>

            {/* File Icon & Preview */}
            <div className="flex-shrink-0">
              {fileItem.preview ? (
                <img
                  src={fileItem.preview}
                  alt={fileItem.file.name}
                  className="w-12 h-12 object-cover rounded"
                />
              ) : (
                <div
                  className={cn(
                    "w-12 h-12 rounded flex items-center justify-center",
                    getFileTypeColor(fileItem.file),
                  )}
                >
                  {getFileIcon(fileItem.file)}
                </div>
              )}
            </div>

            {/* File Info */}
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center space-x-2">
                {/* Order Badge */}
                <Badge
                  variant="outline"
                  className="text-xs font-mono bg-gray-50"
                >
                  #{index + 1}
                </Badge>

                {fileItem.isPrimary && (
                  <Badge
                    variant="default"
                    className="text-xs bg-yellow-100 text-yellow-800 border-yellow-200"
                  >
                    <Star className="w-3 h-3 mr-1 fill-current" />
                    Primary
                  </Badge>
                )}

                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs capitalize",
                    fileItem.file.type.startsWith("video/") &&
                      "bg-blue-50 text-blue-700 border-blue-200",
                    fileItem.file.type.startsWith("image/") &&
                      "bg-green-50 text-green-700 border-green-200",
                    fileItem.file.type.startsWith("audio/") &&
                      "bg-purple-50 text-purple-700 border-purple-200",
                  )}
                >
                  {fileItem.file.type.split("/")[0]}
                </Badge>
              </div>

              {/* Title Input */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700 flex items-center">
                  <Edit2 className="w-3 h-3 mr-1" />
                  Video Title
                </label>
                <Input
                  value={fileItem.displayTitle || ""}
                  onChange={(e) => updateFileTitle(fileItem.id, e.target.value)}
                  placeholder="Enter a descriptive title for this video..."
                  className="text-sm"
                />
              </div>

              <div className="flex items-center justify-between">
                <p
                  className="text-xs text-gray-500 truncate max-w-[200px]"
                  title={fileItem.file.name}
                >
                  {fileItem.file.name}
                </p>
                <p className="text-xs text-gray-500">
                  {formatFileSizeLocal(fileItem.file.size)}
                </p>
              </div>

              {fileItem.progress !== undefined && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>Uploading...</span>
                    <span>{fileItem.progress}%</span>
                  </div>
                  <Progress value={fileItem.progress} className="h-2" />
                </div>
              )}
              {fileItem.error && (
                <p className="text-xs text-red-500">{fileItem.error}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-1">
              {files.length > 1 && !hasPrimaryFile && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setPrimaryFile(fileItem.id)}
                    className={cn(
                      "p-1 hover:bg-yellow-50",
                      fileItem.isPrimary && "text-yellow-600",
                    )}
                    title="Set as primary video"
                  >
                    <Star
                      className={cn(
                        "w-4 h-4",
                        fileItem.isPrimary && "fill-current",
                      )}
                    />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => moveFile(index, "up")}
                    disabled={index === 0}
                    className="p-1 hover:bg-gray-100"
                    title="Move up"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => moveFile(index, "down")}
                    disabled={index === files.length - 1}
                    className="p-1 hover:bg-gray-100"
                    title="Move down"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removeFile(fileItem.id)}
                className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50"
                title="Remove file"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export const MultiFileUploader: React.FC<MultiFileUploaderProps> = ({
  onFilesChange,
  maxFiles,
  maxSizePerFile,
  acceptedFileTypes,
  className,
  existingFilesCount = 0,
  hasPrimaryFile = false,
}) => {
  // Use centralized configuration with fallbacks for props
  const limits = getCurrentLimits();
  const finalMaxFiles = maxFiles ?? limits.maxFiles;
  const finalAcceptedTypes = acceptedFileTypes ?? getAllAcceptedTypes();
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Use enhanced notification system
  const notifications = useUploadNotifications();

  // Configure drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px minimum drag distance
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const getFileIcon = (file: File) => {
    const type = file.type;
    if (type.startsWith("video/")) return <Video className="w-4 h-4" />;
    if (type.startsWith("image/")) return <Image className="w-4 h-4" />;
    if (type.startsWith("audio/")) return <Music className="w-4 h-4" />;
    if (type.includes("pdf") || type.includes("document"))
      return <FileText className="w-4 h-4" />;
    return <File className="w-4 h-4" />;
  };

  const getFileTypeColor = (file: File) => {
    const type = file.type;
    if (type.startsWith("video/")) return "bg-blue-100 text-blue-700";
    if (type.startsWith("image/")) return "bg-green-100 text-green-700";
    if (type.startsWith("audio/")) return "bg-purple-100 text-purple-700";
    if (type.includes("pdf") || type.includes("document"))
      return "bg-orange-100 text-orange-700";
    return "bg-gray-100 text-gray-700";
  };

  // Use centralized file size formatting
  const formatFileSizeLocal = (bytes: number) => formatFileSize(bytes);

  // Generate a default display title from filename
  const generateDefaultTitle = (fileName: string): string => {
    return fileName
      .replace(/\.[^/.]+$/, "")
      .replace(/[_-]/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  // Notify parent component of files with titles
  const notifyFilesChange = useCallback(
    (filesList: FileWithPreview[]) => {
      const filesWithTitles: FileWithTitle[] = filesList.map((f) => ({
        file: f.file,
        displayTitle: f.displayTitle || generateDefaultTitle(f.file.name),
      }));
      onFilesChange(filesWithTitles);
    },
    [onFilesChange],
  );

  // Update display title for a file
  const updateFileTitle = useCallback(
    (fileId: string, title: string) => {
      setFiles((prev) => {
        const updated = prev.map((f) =>
          f.id === fileId ? { ...f, displayTitle: title } : f,
        );
        notifyFilesChange(updated);
        return updated;
      });
    },
    [notifyFilesChange],
  );

  const handleFileSelection = useCallback(
    (newFiles: FileList | File[]) => {
      const fileArray = Array.from(newFiles);

      // Validate file count
      if (files.length + fileArray.length > finalMaxFiles) {
        notifications.showFileCountError(
          files.length + fileArray.length,
          finalMaxFiles,
        );
        return;
      }

      // Process and validate files using centralized validation
      const validFiles: FileWithPreview[] = [];

      fileArray.forEach((file) => {
        // Use centralized file validation
        const validation = validateFile(file);
        if (!validation.isValid) {
          notifications.showValidationError(validation.error || "Invalid file");
          return;
        }

        // Create file with preview and default title
        const fileWithPreview: FileWithPreview = {
          file,
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          // Only set as primary if no primary file exists and this is the first file
          isPrimary:
            !hasPrimaryFile &&
            files.length === 0 &&
            validFiles.length === 0 &&
            existingFilesCount === 0,
          displayTitle: generateDefaultTitle(file.name),
        };

        // Generate preview for images
        if (file.type.startsWith("image/")) {
          const reader = new FileReader();
          reader.onloadend = () => {
            setFiles((prev) =>
              prev.map((f) =>
                f.id === fileWithPreview.id
                  ? { ...f, preview: reader.result as string }
                  : f,
              ),
            );
          };
          reader.readAsDataURL(file);
        }

        validFiles.push(fileWithPreview);
      });

      const newFilesList = [...files, ...validFiles];
      setFiles(newFilesList);
      notifyFilesChange(newFilesList);
    },
    [
      files,
      finalMaxFiles,
      notifyFilesChange,
      hasPrimaryFile,
      existingFilesCount,
      notifications,
    ],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFileSelection(e.dataTransfer.files);
    },
    [handleFileSelection],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const removeFile = useCallback(
    (id: string) => {
      const updatedFiles = files.filter((f) => f.id !== id);

      // If primary file was removed, make the first file primary
      const removedFile = files.find((f) => f.id === id);
      if (
        removedFile?.isPrimary &&
        updatedFiles.length > 0 &&
        !hasPrimaryFile
      ) {
        updatedFiles[0].isPrimary = true;
      }

      setFiles(updatedFiles);
      notifyFilesChange(updatedFiles);
    },
    [files, notifyFilesChange, hasPrimaryFile],
  );

  const moveFile = useCallback(
    (index: number, direction: "up" | "down") => {
      const newFiles = [...files];
      const newIndex = direction === "up" ? index - 1 : index + 1;

      if (newIndex < 0 || newIndex >= files.length) return;

      [newFiles[index], newFiles[newIndex]] = [
        newFiles[newIndex],
        newFiles[index],
      ];
      setFiles(newFiles);
      notifyFilesChange(newFiles);
    },
    [files, notifyFilesChange],
  );

  const setPrimaryFile = useCallback(
    (id: string) => {
      if (hasPrimaryFile) return;

      setFiles(
        files.map((f) => ({
          ...f,
          isPrimary: f.id === id,
        })),
      );
    },
    [files, hasPrimaryFile],
  );

  // Handle drag end for DnD reordering
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        setFiles((items) => {
          const oldIndex = items.findIndex((item) => item.id === active.id);
          const newIndex = items.findIndex((item) => item.id === over.id);

          const newFiles = arrayMove(items, oldIndex, newIndex);
          notifyFilesChange(newFiles);
          return newFiles;
        });
      }
    },
    [notifyFilesChange],
  );

  return (
    <div className={cn("space-y-4", className)}>
      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "relative border-2 border-dashed rounded-lg p-8 text-center transition-all",
          isDragging
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 hover:border-gray-400",
          files.length >= finalMaxFiles && "opacity-50 pointer-events-none",
        )}
      >
        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <p className="text-lg font-medium mb-2">
          {isDragging ? "Drop videos here" : "Drag & drop videos here"}
        </p>
        <p className="text-sm text-gray-500 mb-4">
          or click to select videos from your computer
        </p>
        <input
          type="file"
          multiple
          accept={finalAcceptedTypes.join(",")}
          onChange={(e) =>
            e.target.files && handleFileSelection(e.target.files)
          }
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={files.length >= finalMaxFiles}
        />
        <div className="mt-4 text-xs text-gray-500 space-y-1">
          <p>
            • Supports:{" "}
            {finalAcceptedTypes.map((t) => t.split("/")[1]).join(", ")}
          </p>
          <p>• Sort videos by dragging the handle (⋮⋮) icon</p>
          <p>• Add titles and set a primary thumbnail video</p>
        </div>
      </div>

      {/* File List with Drag & Drop */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between items-center mb-2">
            <div>
              <h3 className="text-sm font-medium">
                Course Videos ({existingFilesCount + files.length}/
                {finalMaxFiles})
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Drag to reorder videos in the order they should appear in the
                course
              </p>
            </div>
            {files.length > 1 && !hasPrimaryFile && (
              <Badge variant="outline" className="text-xs">
                <Star className="w-3 h-3 mr-1" />
                Set primary video
              </Badge>
            )}
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={files.map((f) => f.id)}
              strategy={verticalListSortingStrategy}
            >
              {files.map((fileItem, index) => (
                <SortableFileItem
                  key={fileItem.id}
                  fileItem={fileItem}
                  index={index}
                  files={files}
                  getFileIcon={getFileIcon}
                  getFileTypeColor={getFileTypeColor}
                  updateFileTitle={updateFileTitle}
                  removeFile={removeFile}
                  moveFile={moveFile}
                  setPrimaryFile={setPrimaryFile}
                  hasPrimaryFile={hasPrimaryFile}
                  formatFileSizeLocal={formatFileSizeLocal}
                />
              ))}
            </SortableContext>
          </DndContext>

          {/* Summary Footer */}
          <div className="pt-2 border-t">
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center space-x-4">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-blue-100 border border-blue-300 mr-2"></div>
                  <span className="text-gray-600">
                    {
                      files.filter((f) => f.file.type.startsWith("video/"))
                        .length
                    }{" "}
                    videos
                  </span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-green-100 border border-green-300 mr-2"></div>
                  <span className="text-gray-600">
                    {
                      files.filter((f) => f.file.type.startsWith("image/"))
                        .length
                    }{" "}
                    images
                  </span>
                </div>
              </div>
              <div className="text-gray-600">
                Total:{" "}
                {files.reduce((acc, file) => acc + file.file.size, 0) /
                  (1024 * 1024 * 1024) <
                1
                  ? `${(files.reduce((acc, file) => acc + file.file.size, 0) / (1024 * 1024)).toFixed(1)} MB`
                  : `${(files.reduce((acc, file) => acc + file.file.size, 0) / (1024 * 1024 * 1024)).toFixed(2)} GB`}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
