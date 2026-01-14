'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Search, X } from 'lucide-react'

export default function RefundRequestsManager() {
  const [filters, setFilters] = useState({
    status: '' as string,
    search: '',
  })

  const handleStatusChange = (status: string) => {
    setFilters({ ...filters, status: status || '' })
  }

  const handleSearchChange = (search: string) => {
    setFilters({ ...filters, search })
  }

  return (
    <div className="space-y-6">
      {/* Filters Row */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
        {/* Status Filter */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <Select value={filters.status || undefined} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[180px] focus:ring-0 focus:ring-offset-0 focus:border-gray-300">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="processed">Processed</SelectItem>
            </SelectContent>
          </Select>
          {filters.status && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleStatusChange('')}
              className="h-10 w-10 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Search Field */}
        <div className="flex-1 min-w-0">
          <Label htmlFor="search" className="sr-only">Search</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              id="search"
              placeholder="Search..."
              value={filters.search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10 w-full border-gray-300 bg-white focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-gray-300"
            />
          </div>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="p-8 text-center text-gray-500">
          <p>Refund requests will be displayed here once database content is added.</p>
        </div>
      </Card>
    </div>
  )
}
