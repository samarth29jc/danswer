"use client";

import { DateRangePickerValue } from "@tremor/react";
import Text from "@/components/ui/text";
import Title from "@/components/ui/title";
import { getDatesList, useQueryAnalytics, useUserAnalytics } from "../lib";
import { ThreeDotsLoader } from "@/components/Loading";
import CardSection from "@/components/admin/CardSection";
import { AreaChartDisplay } from "@/components/ui/areaChart";

export function QueryPerformanceChart({
  timeRange,
}: {
  timeRange: DateRangePickerValue;
}) {
  const {
    data: queryAnalyticsData,
    isLoading: isQueryAnalyticsLoading,
    error: queryAnalyticsError,
  } = useQueryAnalytics(timeRange);
  const {
    data: userAnalyticsData,
    isLoading: isUserAnalyticsLoading,
    error: userAnalyticsError,
  } = useUserAnalytics(timeRange);

  let chart;
  if (isQueryAnalyticsLoading || isUserAnalyticsLoading) {
    chart = (
      <div className="h-80 flex flex-col">
        <ThreeDotsLoader />
      </div>
    );
  } else if (
    !queryAnalyticsData ||
    !userAnalyticsData ||
    queryAnalyticsError ||
    userAnalyticsError
  ) {
    chart = (
      <div className="h-80 text-red-600 text-bold flex flex-col">
        <p className="m-auto">Failed to fetch query data...</p>
      </div>
    );
  } else {
    const initialDate = timeRange.from || new Date(queryAnalyticsData[0].date);
    const dateRange = getDatesList(initialDate);

    const dateToQueryAnalytics = new Map(
      queryAnalyticsData.map((queryAnalyticsEntry) => [
        queryAnalyticsEntry.date,
        queryAnalyticsEntry,
      ])
    );
    const dateToUserAnalytics = new Map(
      userAnalyticsData.map((userAnalyticsEntry) => [
        userAnalyticsEntry.date,
        userAnalyticsEntry,
      ])
    );

    chart = (
      <AreaChartDisplay
        chartConfig={{
          height: 30,
          margin: { top: 20, right: 20, bottom: 20, left: 40 },
          xAxis: {
            type: "category",
            dataKey: "Day",
            tickLine: true,
            axisLine: true,
          },
          yAxis: {
            type: "number",
            tickLine: true,
            axisLine: true,
          },
          tooltip: {
            trigger: "axis",
            formatter: (value: any) => `${value}`,
          },
        }}
        className="h-80"
        chartData={dateRange.map((dateStr) => {
          const queryAnalyticsForDate = dateToQueryAnalytics.get(dateStr);
          const userAnalyticsForDate = dateToUserAnalytics.get(dateStr);
          return {
            Day: dateStr,
            Queries: queryAnalyticsForDate?.total_queries || 0,
            "Unique Users": userAnalyticsForDate?.total_active_users || 0,
          };
        })}
        categories={["Queries", "Unique Users"]}
        index="Day"
        // colors={["indigo", "fuchsia"]}
        // valueFormatter={(number: number) =>
        //   `${Intl.NumberFormat("us").format(number).toString()}`
        // }
        // yAxisWidth={60}
      />
    );
  }

  return (
    <CardSection className="mt-8">
      <Title>Usage</Title>
      <Text>Usage over time</Text>
      {chart}
    </CardSection>
  );
}
