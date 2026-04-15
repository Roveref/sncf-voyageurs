import "recharts/types/chart/generateCategoricalChart";

declare module "recharts/types/chart/generateCategoricalChart" {
  interface CategoricalChartProps {
    animationDuration?: number;
    animationEasing?: "ease" | "ease-in" | "ease-out" | "ease-in-out" | "linear" | string;
  }
}
