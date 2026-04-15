import React, { memo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import { styled } from "@mui/material/styles";
import { keyframes } from "@emotion/react";
import { easing, timing } from "../../styles/animations";
import { brand } from "../../config/brandConfig";

// BearingPoint Brand Colors (from brandConfig)
const colors = {
  R50: brand.primary,
  R60: brand.primaryDark,
  R10: brand.primaryBg,
  G60: brand.secondary,
  G50: brand.secondaryLight,
  G40: brand.secondaryLighter,
  G30: brand.secondaryLightest,
  G20: brand.secondaryBg,
  G10: brand.background,
  black: brand.black,
  white: brand.white,
};

// Animations
const fadeInScale = keyframes`
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
`;

const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const shake = keyframes`
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-8px); }
  20%, 40%, 60%, 80% { transform: translateX(8px); }
`;

const float = keyframes`
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-10px);
  }
`;

const pulse = keyframes`
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
`;

// Styled Container
const EmptyStateContainer = styled(Box, {
  shouldForwardProp: (prop) => prop !== "animation",
})<{ animation?: any }>(({ animation }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "60px 24px",
  textAlign: "center",
  minHeight: "400px",
  animation: `${animation} 0.6s ${easing.elegant} forwards`,
}));

// Styled Icon Container
const IconContainer = styled(Box, {
  shouldForwardProp: (prop) => prop !== "iconAnimation",
})<{ iconAnimation?: any }>(({ iconAnimation }) => ({
  marginBottom: "32px",
  animation: iconAnimation ? `${iconAnimation} 3s ${easing.smooth} infinite` : "none",
}));

/**
 * NoDataEmptyState Component
 * Displayed when no file has been uploaded yet
 */
export const NoDataEmptyState = memo(({ onUploadClick }: { onUploadClick?: () => void }) => {
  return (
    <EmptyStateContainer animation={fadeInScale}>
      <IconContainer iconAnimation={float}>
        {/* Inbox/Folder SVG Icon */}
        <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
          {/* Folder Background */}
          <path
            d="M15 35C15 30.5817 18.5817 27 23 27H45L52 35H97C101.418 35 105 38.5817 105 43V87C105 91.4183 101.418 95 97 95H23C18.5817 95 15 91.4183 15 87V35Z"
            fill={colors.G20}
            stroke={colors.G50}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          {/* Folder Tab */}
          <path
            d="M15 35H52L45 27H23C18.5817 27 15 30.5817 15 35Z"
            fill={colors.G30}
            stroke={colors.G50}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          {/* Document Icon inside */}
          <rect x="35" y="50" width="50" height="30" rx="3" fill={colors.white} stroke={colors.G40} strokeWidth="2" />
          <line x1="42" y1="58" x2="70" y2="58" stroke={colors.G30} strokeWidth="2" strokeLinecap="round" />
          <line x1="42" y1="65" x2="78" y2="65" stroke={colors.G30} strokeWidth="2" strokeLinecap="round" />
          <line x1="42" y1="72" x2="65" y2="72" stroke={colors.G30} strokeWidth="2" strokeLinecap="round" />
        </svg>
      </IconContainer>

      <Typography
        variant="h5"
        sx={{
          fontWeight: 600,
          color: colors.black,
          marginBottom: "12px",
          animation: `${fadeIn} 0.6s ${easing.elegant} 0.2s both`,
        }}
      >
        No data loaded yet
      </Typography>

      <Typography
        variant="body1"
        sx={{
          color: colors.G60,
          marginBottom: "32px",
          maxWidth: "400px",
          animation: `${fadeIn} 0.6s ${easing.elegant} 0.3s both`,
        }}
      >
        Upload your Excel file to get started and explore your dashboard insights
      </Typography>

      <Button
        variant="contained"
        color="primary"
        size="large"
        onClick={onUploadClick}
        sx={{
          paddingX: "32px",
          paddingY: "12px",
          fontSize: "1rem",
          fontWeight: 600,
          animation: `${fadeIn} 0.6s ${easing.elegant} 0.4s both`,
          transition: `transform ${timing.normal} ${easing.elegant}, box-shadow ${timing.normal} ${easing.elegant}`,
          "&:hover": {
            transform: "translateY(-2px)",
            boxShadow: "0 8px 16px rgba(255, 61, 71, 0.3)",
          },
        }}
      >
        Upload Excel File
      </Button>
    </EmptyStateContainer>
  );
});

/**
 * NoResultsEmptyState Component
 * Displayed when filters return no results
 */
export const NoResultsEmptyState = memo(
  ({ onClearFilters, message = "No results found" }: { onClearFilters?: any; message?: string }) => {
    return (
      <EmptyStateContainer animation={fadeIn}>
        <IconContainer iconAnimation={pulse}>
          {/* Magnifying Glass with X SVG Icon */}
          <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
            {/* Magnifying Glass Circle */}
            <circle cx="50" cy="50" r="25" fill={colors.G10} stroke={colors.G50} strokeWidth="4" />
            {/* Magnifying Glass Handle */}
            <line x1="68" y1="68" x2="88" y2="88" stroke={colors.G50} strokeWidth="4" strokeLinecap="round" />
            {/* X mark inside magnifying glass */}
            <line x1="42" y1="42" x2="58" y2="58" stroke={colors.R50} strokeWidth="3" strokeLinecap="round" />
            <line x1="58" y1="42" x2="42" y2="58" stroke={colors.R50} strokeWidth="3" strokeLinecap="round" />
          </svg>
        </IconContainer>

        <Typography
          variant="h5"
          sx={{
            fontWeight: 600,
            color: colors.black,
            marginBottom: "12px",
            animation: `${fadeIn} 0.6s ${easing.elegant} 0.1s both`,
          }}
        >
          {message}
        </Typography>

        <Typography
          variant="body1"
          sx={{
            color: colors.G60,
            marginBottom: "32px",
            maxWidth: "400px",
            animation: `${fadeIn} 0.6s ${easing.elegant} 0.2s both`,
          }}
        >
          Try adjusting your filters or search criteria to see more results
        </Typography>

        {onClearFilters && (
          <Button
            variant="outlined"
            color="primary"
            size="large"
            onClick={onClearFilters}
            sx={{
              paddingX: "32px",
              paddingY: "12px",
              fontSize: "1rem",
              fontWeight: 600,
              animation: `${fadeIn} 0.6s ${easing.elegant} 0.3s both`,
              transition: `transform ${timing.normal} ${easing.elegant}, background-color ${timing.normal} ${easing.elegant}`,
              "&:hover": {
                transform: "translateY(-2px)",
                backgroundColor: colors.R10,
              },
            }}
          >
            Clear Filters
          </Button>
        )}
      </EmptyStateContainer>
    );
  }
);

/**
 * ErrorEmptyState Component
 * Displayed when an error occurs
 */
export const ErrorEmptyState = memo(
  ({
    errorMessage = "Something went wrong",
    onRetry,
    retryLabel = "Try Again",
  }: {
    errorMessage?: string;
    onRetry?: () => void;
    retryLabel?: string;
  }) => {
    return (
      <EmptyStateContainer animation={shake}>
        <IconContainer>
          {/* Alert/Warning SVG Icon */}
          <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
            {/* Alert Triangle Background */}
            <path
              d="M60 20L100 90H20L60 20Z"
              fill={colors.R10}
              stroke={colors.R50}
              strokeWidth="4"
              strokeLinejoin="round"
            />
            {/* Exclamation Mark */}
            <line x1="60" y1="45" x2="60" y2="68" stroke={colors.R60} strokeWidth="5" strokeLinecap="round" />
            <circle cx="60" cy="78" r="3" fill={colors.R60} />

            {/* Pulsing Circle Animation */}
            <circle
              cx="60"
              cy="60"
              r="50"
              fill="none"
              stroke={colors.R50}
              strokeWidth="2"
              opacity="0.3"
              style={{
                animation: `${pulse} 2s ${easing.smooth} infinite`,
              }}
            />
          </svg>
        </IconContainer>

        <Typography
          variant="h5"
          sx={{
            fontWeight: 600,
            color: colors.R60,
            marginBottom: "12px",
            animation: `${fadeIn} 0.6s ${easing.elegant} 0.2s both`,
          }}
        >
          {errorMessage}
        </Typography>

        <Typography
          variant="body1"
          sx={{
            color: colors.G60,
            marginBottom: "32px",
            maxWidth: "400px",
            animation: `${fadeIn} 0.6s ${easing.elegant} 0.3s both`,
          }}
        >
          We encountered an issue while processing your request. Please try again.
        </Typography>

        {onRetry && (
          <Button
            variant="contained"
            color="primary"
            size="large"
            onClick={onRetry}
            sx={{
              paddingX: "32px",
              paddingY: "12px",
              fontSize: "1rem",
              fontWeight: 600,
              animation: `${fadeIn} 0.6s ${easing.elegant} 0.4s both`,
              transition: `transform ${timing.normal} ${easing.elegant}, box-shadow ${timing.normal} ${easing.elegant}`,
              "&:hover": {
                transform: "translateY(-2px)",
                boxShadow: "0 8px 16px rgba(255, 61, 71, 0.3)",
              },
            }}
          >
            {retryLabel}
          </Button>
        )}
      </EmptyStateContainer>
    );
  }
);

/**
 * LoadingEmptyState Component (Bonus)
 * Displayed while data is being processed
 */
export const LoadingEmptyState = memo(({ message = "Loading your data..." }: { message?: string }) => {
  const spinnerAnimation = keyframes`
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  `;

  return (
    <EmptyStateContainer animation={fadeIn}>
      <IconContainer>
        {/* Loading Spinner */}
        <Box
          sx={{
            width: "80px",
            height: "80px",
            border: `4px solid ${colors.G20}`,
            borderTop: `4px solid ${colors.R50}`,
            borderRadius: "50%",
            animation: `${spinnerAnimation} 1s linear infinite`,
          }}
        />
      </IconContainer>

      <Typography
        variant="h5"
        sx={{
          fontWeight: 600,
          color: colors.black,
          marginBottom: "12px",
          animation: `${fadeIn} 0.6s ${easing.elegant} 0.1s both`,
        }}
      >
        {message}
      </Typography>

      <Typography
        variant="body1"
        sx={{
          color: colors.G60,
          maxWidth: "400px",
          animation: `${fadeIn} 0.6s ${easing.elegant} 0.2s both`,
        }}
      >
        Please wait while we process your information
      </Typography>
    </EmptyStateContainer>
  );
});

// Export all components
export default {
  NoDataEmptyState,
  NoResultsEmptyState,
  ErrorEmptyState,
  LoadingEmptyState,
};
