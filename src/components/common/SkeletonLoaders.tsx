/**
 * Skeleton Loading Components
 * Premium loading states for better perceived performance
 */

import React, { memo } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Skeleton from "@mui/material/Skeleton";
import Grid from "@mui/material/Grid2";
import { animations } from "../../styles/animations";

/**
 * Skeleton Card Loader
 * Used for dashboard overview cards
 */
export const SkeletonCard = memo(({ height = 200, showChart = false }: { height?: number; showChart?: boolean }) => (
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
));

/**
 * Skeleton Table Loader
 * Used for data tables and lists
 */
export const SkeletonTable = memo(({ rows = 5, columns = 6 }: { rows?: number; columns?: number }) => (
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
));

/**
 * Skeleton Chart Loader
 * Used for recharts placeholders
 */
export const SkeletonChart = memo(({ height = 300, type = "bar" }: { height?: number; type?: string }) => (
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
));

/**
 * Skeleton Grid Loader
 * Used for dashboard grid layouts
 */
export const SkeletonGrid = memo(({ items = 4, columns = 2 }: { items?: number; columns?: number }) => (
  <Grid container spacing={3}>
    {Array.from({ length: items }).map((_, i) => (
      <Grid size={{ xs: 12, md: 12 / columns }} key={`skeleton-grid-${i}`}>
        <SkeletonCard height={200} showChart />
      </Grid>
    ))}
  </Grid>
));

/**
 * Skeleton Dashboard
 * Complete dashboard loading state
 */
export const SkeletonDashboard = memo(() => (
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
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Skeleton variant="text" width="40%" height={32} sx={{ mb: 2 }} />
              <SkeletonChart height={300} type="bar" />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
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
));

/**
 * Pulse Loader for inline elements
 */
export const PulseLoader = memo(({ width = 60, height = 20 }: { width?: number; height?: number }) => (
  <Skeleton
    variant="text"
    width={width}
    height={height}
    sx={{
      ...animations.pulseEffect,
      display: "inline-block",
    }}
  />
));

/**
 * Skeleton Sidebar Loader
 * Mimics the filter sidebar layout during loading
 */
export const SkeletonSidebar = memo(() => (
  <Box sx={{ p: 3, display: "flex", flexDirection: "column", height: "100%" }}>
    {/* Title */}
    <Skeleton variant="text" width="50%" height={32} sx={{ mb: 1 }} />
    <Skeleton variant="rectangular" height={1} sx={{ mb: 3, opacity: 0.3 }} />

    {/* Filter groups */}
    {Array.from({ length: 5 }).map((_, i) => (
      <Box key={`sidebar-group-${i}`} sx={{ mb: 2.5 }}>
        <Skeleton variant="text" width={`${55 + (i % 3) * 10}%`} height={24} sx={{ mb: 1 }} />
        {Array.from({ length: 2 + (i % 2) }).map((_, j) => (
          <Box key={`sidebar-item-${i}-${j}`} sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75, pl: 1 }}>
            <Skeleton variant="circular" width={16} height={16} sx={{ flexShrink: 0 }} />
            <Skeleton variant="text" width={`${40 + (j % 3) * 15}%`} height={20} />
          </Box>
        ))}
      </Box>
    ))}
  </Box>
));

export default {
  SkeletonCard,
  SkeletonTable,
  SkeletonChart,
  SkeletonGrid,
  SkeletonDashboard,
  SkeletonSidebar,
  PulseLoader,
};
