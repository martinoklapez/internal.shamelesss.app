'use client'

import * as React from 'react'
import { ResponsiveContainer } from 'recharts'
import { cn } from '@/lib/utils'

export type ChartConfig = Record<
  string,
  {
    label?: string
    color?: string
    icon?: React.ComponentType<{ className?: string }>
  }
>

const ChartConfigContext = React.createContext<ChartConfig | null>(null)

function useChartConfig() {
  const config = React.useContext(ChartConfigContext)
  return config
}

export interface ChartContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  config: ChartConfig
  children: React.ReactElement
}

const ChartContainer = React.forwardRef<HTMLDivElement, ChartContainerProps>(
  ({ config, className, children, ...props }, ref) => {
    return (
      <ChartConfigContext.Provider value={config}>
        <div
          ref={ref}
          className={cn('w-full', className)}
          style={{ minHeight: 200 }}
          {...props}
        >
          <ResponsiveContainer width="100%" height="100%" minHeight={200}>
            {children}
          </ResponsiveContainer>
        </div>
      </ChartConfigContext.Provider>
    )
  }
)
ChartContainer.displayName = 'ChartContainer'

export interface ChartTooltipContentProps {
  active?: boolean
  payload?: Array<{ name?: string; value?: number; dataKey?: string; color?: string; fill?: string }>
  label?: string
  className?: string
  nameKey?: string
  labelKey?: string
}

const ChartTooltipContent = React.forwardRef<HTMLDivElement, ChartTooltipContentProps>(
  ({ active, payload, label, className, nameKey, labelKey }, ref) => {
    const config = useChartConfig()
    if (!active || !payload?.length) return null
    const name = labelKey && label ? String(label) : payload[0]?.dataKey
    const displayLabel = config && name ? (config[name]?.label ?? name) : name
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs shadow-md',
          className
        )}
      >
        {label != null && (
          <p className="mb-1 font-medium text-gray-900">{String(label)}</p>
        )}
        <div className="flex flex-col gap-1">
          {payload.map((entry, index) => {
            const key = nameKey ?? entry.dataKey ?? entry.name
            const itemLabel = config && key ? (config[key]?.label ?? key) : key
            return (
              <div key={index} className="flex items-center justify-between gap-4">
                <span className="text-gray-600">{itemLabel}</span>
                <span className="font-mono font-medium tabular-nums text-gray-900">
                  {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }
)
ChartTooltipContent.displayName = 'ChartTooltipContent'

export { ChartContainer, ChartTooltipContent, useChartConfig }
