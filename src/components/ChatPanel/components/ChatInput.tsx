/**
 * ChatInput — Bottom bar with branding, scoring config, voice, text input, and action buttons.
 * Extracted from ChatPanel for line count reduction.
 */
import { memo, useState, useRef, useCallback } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import Slider from "@mui/material/Slider";
import Collapse from "@mui/material/Collapse";
import { alpha } from "@mui/material/styles";
import SendIcon from "@mui/icons-material/Send";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import TuneIcon from "@mui/icons-material/Tune";
import { easing, timing } from "../../../styles/animations";
import { brand } from "../../../config/brandConfig";
import type { ScoringConfig } from "../../../services/api";

interface ChatInputProps {
  provider: "ollama" | "claude";
  pb: { fabIcon: string; fabIconFilter: string; name: string };
  input: string;
  setInput: (v: string) => void;
  loading: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onSend: (text?: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onNewSession: () => void;
  onClose: () => void;
  scoringConfig: ScoringConfig;
  onScoringConfigChange: (fn: (prev: ScoringConfig) => ScoringConfig) => void;
  hasSpeechAPI: boolean;
}

const ChatInput = memo(
  ({
    provider,
    pb,
    input,
    setInput,
    loading,
    inputRef,
    onSend,
    onKeyDown,
    onNewSession,
    onClose,
    scoringConfig,
    onScoringConfigChange,
    hasSpeechAPI,
  }: ChatInputProps) => {
    const [scoringOpen, setScoringOpen] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null);
    const handleSendRef = useRef<((text?: string) => void) | undefined>(undefined);
    handleSendRef.current = onSend;

    const toggleVoice = useCallback(() => {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SR) return;

      if (isListening) {
        recognitionRef.current?.stop();
        setIsListening(false);
        setTimeout(() => handleSendRef.current?.(), 50);
        return;
      }

      const recognition = new SR();
      recognition.lang = "fr-FR";
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((r: any) => r[0].transcript)
          .join("");
        setInput(transcript);
      };

      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    }, [isListening, setInput]);

    return (
      <>
        {/* Scoring config panel */}
        {provider === "claude" && (
          <Collapse in={scoringOpen}>
            <Box
              sx={{
                px: 2.5,
                py: 1.5,
                flexShrink: 0,
                mx: "auto",
                width: "100%",
                maxWidth: 1100,
                bgcolor: "rgba(255,255,255,0.05)",
                borderRadius: 2,
                mb: 0.5,
              }}
            >
              <Typography
                variant="caption"
                sx={{ fontWeight: 600, color: "rgba(255,255,255,0.5)", fontSize: 11, mb: 1.5, display: "block" }}
              >
                Staffing filters
              </Typography>
              {[
                { label: "Availability", key: "minAvailPct" as const, levels: ["Strict", "Moyen", "Flexible"] },
                { label: "Skills", key: "minSkillsPct" as const, levels: ["Strict", "Moyen", "Flexible"] },
                { label: "Grade", key: "maxGradeDist" as const, levels: ["Exact", "±1", "±2"] },
                { label: "Period", key: "periodTolerance" as const, levels: ["Exact", "±1 month", "±3 months"] },
              ].map(({ label, key, levels }) => (
                <Box key={key} sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.75 }}>
                  <Typography sx={{ fontSize: 11.5, color: "rgba(255,255,255,0.5)", minWidth: 95, flexShrink: 0 }}>
                    {label}
                  </Typography>
                  <Slider
                    size="small"
                    value={scoringConfig[key]}
                    min={0}
                    max={2}
                    step={1}
                    marks={levels.map((l, i) => ({ value: i, label: l }))}
                    onChange={(_, v) => onScoringConfigChange((prev) => ({ ...prev, [key]: v as number }))}
                    sx={{
                      flex: 1,
                      color: "#D97757",
                      "& .MuiSlider-thumb": { width: 14, height: 14 },
                      "& .MuiSlider-rail": { opacity: 0.2 },
                      "& .MuiSlider-markLabel": { fontSize: 10, color: "rgba(255,255,255,0.4)", top: 22 },
                      "& .MuiSlider-mark": { display: "none" },
                    }}
                  />
                </Box>
              ))}
            </Box>
          </Collapse>
        )}

        {/* Bottom bar: branding + input */}
        <Box
          sx={{
            px: 2,
            py: 1.5,
            pb: 3,
            display: "flex",
            gap: 1,
            alignItems: "flex-end",
            flexShrink: 0,
            width: "100%",
          }}
        >
          {/* Brand icon */}
          <Box
            component="img"
            src={pb.fabIcon}
            sx={{ width: 22, height: 22, filter: pb.fabIconFilter, opacity: 0.7, mb: 0.9, flexShrink: 0 }}
            alt={pb.name}
          />
          {/* Scoring toggle button */}
          {provider === "claude" && (
            <Tooltip title="Staffing filters">
              <IconButton
                size="small"
                onClick={() => setScoringOpen(!scoringOpen)}
                aria-label="Staffing scoring filters"
                sx={{
                  color: scoringOpen ? "#D97757" : "rgba(255,255,255,0.5)",
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  bgcolor: scoringOpen ? "rgba(217,119,87,0.2)" : "transparent",
                  "&:hover": { bgcolor: "rgba(217,119,87,0.25)" },
                }}
              >
                <TuneIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
          {hasSpeechAPI && (
            <IconButton
              size="small"
              onClick={toggleVoice}
              aria-label={isListening ? "Stop voice recognition" : "Start voice recognition"}
              sx={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                color: isListening ? "#fff" : "rgba(255,255,255,0.5)",
                bgcolor: isListening ? brand.primary : "transparent",
                animation: isListening ? "pulse 1.5s infinite" : "none",
                "@keyframes pulse": {
                  "0%": { boxShadow: `0 0 0 0 ${alpha(brand.primary, 0.4)}` },
                  "70%": { boxShadow: `0 0 0 8px ${alpha(brand.primary, 0)}` },
                  "100%": { boxShadow: `0 0 0 0 ${alpha(brand.primary, 0)}` },
                },
                "&:hover": { bgcolor: isListening ? brand.primaryDark : "rgba(255,255,255,0.1)" },
              }}
            >
              {isListening ? <MicOffIcon sx={{ fontSize: 18 }} /> : <MicIcon sx={{ fontSize: 18 }} />}
            </IconButton>
          )}
          <TextField
            inputRef={inputRef}
            fullWidth
            multiline
            maxRows={3}
            placeholder={
              isListening
                ? "Speak... click the mic to send"
                : provider === "claude"
                  ? "Ask Claude..."
                  : "Ask your question..."
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={loading}
            size="small"
            inputProps={{ "aria-label": "Message to send" }}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: "24px",
                fontSize: 14,
                color: "rgba(255,255,255,0.9)",
                bgcolor: "rgba(255,255,255,0.08)",
                px: 1,
                "& fieldset": { border: "1px solid rgba(255,255,255,0.12)" },
                "&:hover fieldset": { borderColor: "rgba(255,255,255,0.25)" },
                "&.Mui-focused fieldset": {
                  border: `1.5px solid ${provider === "claude" ? "#D97757" : "rgba(255,255,255,0.4)"}`,
                },
              },
              "& .MuiInputBase-input::placeholder": {
                color: "rgba(255,255,255,0.35)",
                opacity: 1,
              },
            }}
          />
          <IconButton
            onClick={() => onSend()}
            disabled={!input.trim() || loading}
            aria-label="Send message"
            sx={{
              bgcolor: provider === "claude" ? "#D97757" : "rgba(255,255,255,0.15)",
              color: "#fff",
              width: 36,
              height: 36,
              borderRadius: "50%",
              "&:hover": { bgcolor: provider === "claude" ? "#C4673F" : "rgba(255,255,255,0.25)" },
              "&.Mui-disabled": { bgcolor: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.2)" },
              transition: `background-color ${timing.fast} ${easing.standard}, color ${timing.fast} ${easing.standard}`,
            }}
          >
            {loading ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : <SendIcon sx={{ fontSize: 16 }} />}
          </IconButton>
          {/* Spacer */}
          <Box sx={{ width: 8, flexShrink: 0 }} />
          {/* New session */}
          <Tooltip title="New conversation">
            <IconButton
              size="small"
              onClick={onNewSession}
              aria-label="New conversation"
              sx={{ color: "rgba(255,255,255,0.35)", "&:hover": { color: "rgba(255,255,255,0.8)" }, mb: 0.25 }}
            >
              <DeleteOutlineIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          {/* Close */}
          <IconButton
            size="small"
            onClick={onClose}
            aria-label="Close assistant"
            sx={{ color: "rgba(255,255,255,0.35)", "&:hover": { color: "rgba(255,255,255,0.8)" }, mb: 0.25 }}
          >
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      </>
    );
  }
);

ChatInput.displayName = "ChatInput";

export { ChatInput };
