/**
 * Skeleton Loading Components
 * Premium loading states for better perceived performance
 */

import React from "react";
import { Box, Card, CardContent, Skeleton, Grid } from "@mui/material";
import { animations } from "../../styles/animations";

/**
 * Skeleton Card Loader
 * Used for dashboard overview cards
 */
export const SkeletonCard = ({ height = 200, showChart = false }) => (
  <Card
    sx={{
      height,
      ...animations.shimmerLoading,
      ...animations.cardEntrance(0),
    }}
  >
    <CardContent>
      <Skeleton variant="text" width="40%" height={32} sx={{ mb: 2 }} />
      <Skeleton variant="text" width="60%" height={48} sx={{ mb: 2 }} />
      {showChart && (
        <Box sx={{ mt: 2 }}>
          <Skeleton variant="rectangular" height={100} sx={{ borderRadius: 2 }} />
        </Box>
      )}
    </CardContent>
  </Card>
);

/**
 * Skeleton Table Loader
 * Used for data tables and lists
 */
export const SkeletonTable = ({ rows = 5, columns = 6 }) => (
  <Box sx={{ width: "100%" }}>
    {/* Header */}
    <Box sx={{ display: "flex", gap: 2, mb: 2, px: 2 }}>
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={`header-${i}`} variant="text" width={`${100 / columns}%`} height={40} />
      ))}
    </Box>

    {/* Rows */}
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <Box
        key={`row-${rowIndex}`}
        sx={{
          display: "flex",
          gap: 2,
          mb: 1.5,
          px: 2,
          py: 1,
          borderRadius: 1,
          ...animations.shimmerLoading,
        }}
      >
        {Array.from({ length: columns }).map((_, colIndex) => (
          <Skeleton key={`cell-${rowIndex}-${colIndex}`} variant="text" width={`${100 / columns}%`} height={32} />
        ))}
      </Box>
    ))}
  </Box>
);

/**
 * Skeleton Chart Loader
 * Used for recharts placeholders
 */
export const SkeletonChart = ({ height = 300, type = "bar" }) => (
  <Box
    sx={{
      height,
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "space-around",
      gap: 2,
      px: 2,
      py: 2,
      ...animations.shimmerLoading,
    }}
  >
    {type === "bar" ? (
      Array.from({ length: 8 }).map((_, i) => (
        <Skeleton
          key={`bar-${i}`}
          variant="rectangular"
          width="10%"
          height={`${Math.random() * 60 + 40}%`}
          sx={{ borderRadius: 1 }}
        />
      ))
    ) : type === "line" ? (
      <Skeleton variant="rectangular" width="100%" height="80%" sx={{ borderRadius: 2 }} />
    ) : (
      <Skeleton variant="circular" width={height * 0.7} height={height * 0.7} />
    )}
  </Box>
);

/**
 * Skeleton Grid Loader
 * Used for dashboard grid layouts
 */
export const SkeletonGrid = ({ items = 4, columns = 2 }) => (
  <Grid container spacing={3}>
    {Array.from({ length: items }).map((_, i) => (
      <Grid item xs={12} md={12 / columns} key={`skeleton-grid-${i}`}>
        <SkeletonCard height={200} showChart />
      </Grid>
    ))}
  </Grid>
);

/**
 * Skeleton Dashboard
 * Complete dashboard loading state
 */
export const SkeletonDashboard = () => (
  <Box sx={{ p: 3 }}>
    {/* Header */}
    <Box sx={{ mb: 4 }}>
      <Skeleton variant="text" width="30%" height={48} sx={{ mb: 2 }} />
      <Skeleton variant="text" width="50%" height={32} />
    </Box>

    {/* Overview Cards */}
    <SkeletonGrid items={4} columns={4} />

    {/* Charts Section */}
    <Box sx={{ mt: 4 }}>
      <Skeleton variant="text" width="20%" height={32} sx={{ mb: 3 }} />
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Skeleton variant="text" width="40%" height={32} sx={{ mb: 2 }} />
              <SkeletonChart height={300} type="bar" />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Skeleton variant="text" width="40%" height={32} sx={{ mb: 2 }} />
              <SkeletonChart height={300} type="pie" />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>

    {/* Table Section */}
    <Box sx={{ mt: 4 }}>
      <Skeleton variant="text" width="20%" height={32} sx={{ mb: 3 }} />
      <Card>
        <CardContent>
          <SkeletonTable rows={8} columns={6} />
        </CardContent>
      </Card>
    </Box>
  </Box>
);

/**
 * Pulse Loader for inline elements
 */
export const PulseLoader = ({ width = 60, height = 20 }) => (
  <Skeleton
    variant="text"
    width={width}
    height={height}
    sx={{
      ...animations.pulseEffect,
      display: "inline-block",
    }}
  />
);

export default {
  SkeletonCard,
  SkeletonTable,
  SkeletonChart,
  SkeletonGrid,
  SkeletonDashboard,
  PulseLoader,
};
