import React, { useState } from "react";
import {
  Button,
  Box,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DescriptionIcon from "@mui/icons-material/Description";
import DeleteIcon from "@mui/icons-material/Delete";
import BusinessIcon from "@mui/icons-material/Business";
import PeopleIcon from "@mui/icons-material/People";
import { easing, keyframes } from "../styles/animations";

const FileUploader = ({ onFileUploaded, hasData, fileType = "opportunity" }) => {
  const [file, setFile] = useState(null);
  const [fileHandle, setFileHandle] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false); // Don't auto-open the dialog
  const [selectedFileType, setSelectedFileType] = useState(fileType);

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  const handleFileChange = (e) => {
    handleFiles(e.target.files);
  };

  const handleFileTypeChange = (e) => {
    setSelectedFileType(e.target.value);
  };

  const handleFiles = (files, handle = null) => {
    if (files.length === 0) return;

    const selectedFile = files[0];

    // Check file type
    if (!selectedFile.name.endsWith(".xlsx") && !selectedFile.name.endsWith(".xls")) {
      setError("Please upload an Excel file (.xlsx or .xls)");
      return;
    }

    setFile(selectedFile);
    setFileHandle(handle);
    setError("");
  };

  // Use File System Access API to get a persistent file handle
  const handlePickFile = async () => {
    if (window.showOpenFilePicker) {
      try {
        const [handle] = await window.showOpenFilePicker({
          types: [
            {
              description: "Excel files",
              accept: {
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
                "application/vnd.ms-excel": [".xls"],
              },
            },
          ],
          multiple: false,
        });
        const f = await handle.getFile();
        handleFiles([f], handle);
      } catch (err) {
        // User cancelled the picker
        if (err.name !== "AbortError") {
          setError("Failed to open file picker.");
        }
      }
    } else {
      // Fallback to classic file input
      document.getElementById("file-input").click();
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    try {
      // Read the file as ArrayBuffer
      const buffer = await readFile(file);
      // Pass the file data, type, and file handle (if available) to the parent component
      onFileUploaded(file.name, buffer, selectedFileType, fileHandle);
      // Close the dialog if open
      setOpen(false);
    } catch {
      setError("Failed to read the file. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const readFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsArrayBuffer(file);
    });
  };

  const clearFile = () => {
    setFile(null);
  };

  const openUploadDialog = () => {
    setOpen(true);
  };

  const closeUploadDialog = () => {
    setOpen(false);
  };

  // Determine the button's appearance based on the file type
  const getButtonAppearance = () => {
    const isOpportunityFile = fileType === "opportunity";

    return {
      icon: isOpportunityFile ? <BusinessIcon /> : <PeopleIcon />,
      color: isOpportunityFile ? "primary" : "secondary",
      label: isOpportunityFile
        ? hasData
          ? "Change Opportunity File"
          : "Upload Opportunity File"
        : hasData
          ? "Change Staffing File"
          : "Upload Staffing File",
    };
  };

  const buttonAppearance = getButtonAppearance();

  return (
    <>
      <Button
        variant="outlined"
        startIcon={buttonAppearance.icon}
        onClick={openUploadDialog}
        color={buttonAppearance.color}
        TouchRippleProps={{
          style: {
            animationDuration: "400ms",
          },
        }}
        sx={{
          ml: 2,
          transition: `all 0.2s ${easing.bounce}`,
          "&:hover": {
            transform: "scale(1.05)",
            "& .MuiButton-startIcon": {
              transform: "scale(1.1) rotate(5deg)",
              transition: `all 0.2s ${easing.bounce}`,
            },
          },
          "&:active": {
            transform: "scale(0.98)",
          },
        }}
      >
        {buttonAppearance.label}
      </Button>

      <Dialog open={open} onClose={closeUploadDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {fileType === "opportunity" ? "Upload Opportunity Data File" : "Upload Staffing Data File"}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ p: 2 }}>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel id="file-type-label">File Type</InputLabel>
              <Select
                labelId="file-type-label"
                id="file-type-select"
                value={selectedFileType}
                label="File Type"
                onChange={handleFileTypeChange}
              >
                <MenuItem value="opportunity">
                  <Box sx={{ display: "flex", alignItems: "center" }}>
                    <BusinessIcon sx={{ mr: 1, color: "primary.main" }} />
                    <Typography>Opportunity Data</Typography>
                  </Box>
                </MenuItem>
                <MenuItem value="staffing">
                  <Box sx={{ display: "flex", alignItems: "center" }}>
                    <PeopleIcon sx={{ mr: 1, color: "secondary.main" }} />
                    <Typography>Staffing Data</Typography>
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>

            <Paper
              sx={{
                border: "2px dashed",
                borderColor: "divider",
                borderRadius: 2,
                p: 4,
                textAlign: "center",
                bgcolor: "action.hover",
                cursor: "pointer",
                "&:hover": {
                  bgcolor: "action.selected",
                  borderColor: "text.disabled",
                },
              }}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={handlePickFile}
            >
              {loading ? (
                <CircularProgress size={40} />
              ) : file ? (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "column",
                  }}
                >
                  <DescriptionIcon sx={{ fontSize: 48, color: "primary.main", mb: 1 }} />
                  <Typography variant="body1">{file.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {(file.size / 1024).toFixed(2)} KB
                  </Typography>
                  <Chip
                    label={selectedFileType === "opportunity" ? "Opportunity Data" : "Staffing Data"}
                    color={selectedFileType === "opportunity" ? "primary" : "secondary"}
                    sx={{ mt: 1 }}
                  />
                  <Box sx={{ display: "flex", mt: 2, gap: 2 }}>
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={(e) => {
                        e.stopPropagation();
                        clearFile();
                      }}
                      TouchRippleProps={{
                        style: {
                          animationDuration: "400ms",
                        },
                      }}
                      sx={{
                        transition: `all 0.2s ${easing.bounce}`,
                        "&:hover": {
                          transform: "scale(1.05)",
                          "& .MuiButton-startIcon": {
                            transform: "scale(1.1) rotate(5deg)",
                            transition: `all 0.2s ${easing.bounce}`,
                          },
                        },
                        "&:active": {
                          transform: "scale(0.98)",
                        },
                      }}
                    >
                      Remove
                    </Button>
                    <Button
                      variant="contained"
                      color={selectedFileType === "opportunity" ? "primary" : "secondary"}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpload();
                      }}
                      disabled={loading}
                      startIcon={loading ? <CircularProgress size={18} color="inherit" /> : null}
                      TouchRippleProps={{
                        style: {
                          animationDuration: "400ms",
                        },
                      }}
                      sx={{
                        transition: `all 0.2s ${easing.bounce}`,
                        "&:hover": {
                          transform: "scale(1.05)",
                        },
                        "&:active": {
                          transform: "scale(0.98)",
                        },
                        "& .MuiCircularProgress-root": {
                          animation: "spin 1s linear infinite",
                          ...keyframes.spin,
                        },
                      }}
                    >
                      {loading ? "Uploading..." : "Upload"}
                    </Button>
                  </Box>
                </Box>
              ) : (
                <Box>
                  <CloudUploadIcon
                    sx={{
                      fontSize: 48,
                      color: selectedFileType === "opportunity" ? "primary.main" : "secondary.main",
                      mb: 1,
                    }}
                  />
                  <Typography variant="h6">Drag & Drop or Click to Upload</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Upload your Excel file (.xlsx or .xls)
                  </Typography>
                  <Chip
                    label={selectedFileType === "opportunity" ? "Opportunity Data" : "Staffing Data"}
                    color={selectedFileType === "opportunity" ? "primary" : "secondary"}
                    sx={{ mt: 1 }}
                  />
                </Box>
              )}
              <input
                id="file-input"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />
            </Paper>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={closeUploadDialog}
            color={selectedFileType === "opportunity" ? "primary" : "secondary"}
            TouchRippleProps={{
              style: {
                animationDuration: "400ms",
              },
            }}
            sx={{
              transition: `all 0.2s ${easing.bounce}`,
              "&:hover": {
                transform: "scale(1.05)",
              },
              "&:active": {
                transform: "scale(0.98)",
              },
            }}
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default FileUploader;
