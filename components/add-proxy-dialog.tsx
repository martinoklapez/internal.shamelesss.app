'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Proxy {
  id?: string
  type: 'HTTP' | 'SOCKS5' | 'SOCKS4'
  host: string
  port: number
  username?: string | null
  password?: string | null
  api_address?: string | null
  country?: string | null
  city?: string | null
  fraud_score?: number | null
  asn?: string | null
}

interface AddProxyDialogProps {
  deviceId: string
  proxy?: Proxy | null
  children?: React.ReactNode
}

export function AddProxyDialog({ deviceId, proxy, children }: AddProxyDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const isEditing = !!proxy
  const [formData, setFormData] = useState({
    type: '' as 'HTTP' | 'SOCKS5' | 'SOCKS4' | '',
    host: '',
    port: '',
    username: '',
    password: '',
    api_address: '',
    country: '',
    city: '',
    fraud_score: '',
    asn: '',
  })
  const router = useRouter()

  // Populate form when editing
  useEffect(() => {
    if (open && proxy) {
      setFormData({
        type: proxy.type || '',
        host: proxy.host || '',
        port: proxy.port?.toString() || '',
        username: proxy.username || '',
        password: proxy.password || '',
        api_address: proxy.api_address || '',
        country: proxy.country || '',
        city: proxy.city || '',
        fraud_score: proxy.fraud_score?.toString() || '',
        asn: proxy.asn || '',
      })
    } else if (open && !proxy) {
      // Reset form when creating new
      setFormData({
        type: '',
        host: '',
        port: '',
        username: '',
        password: '',
        api_address: '',
        country: '',
        city: '',
        fraud_score: '',
        asn: '',
      })
    }
  }, [open, proxy])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.type || !formData.host || !formData.port) {
      return
    }

    setIsLoading(true)

    try {
      const url = isEditing ? '/api/proxies/update' : '/api/proxies/create'
      const body = isEditing
        ? {
            proxyId: proxy!.id,
            type: formData.type,
            host: formData.host,
            port: parseInt(formData.port, 10),
            username: formData.username || null,
            password: formData.password || null,
            api_address: formData.api_address || null,
            country: formData.country || null,
            city: formData.city || null,
            fraud_score: formData.fraud_score ? parseInt(formData.fraud_score, 10) : null,
            asn: formData.asn || null,
          }
        : {
            device_id: parseInt(deviceId, 10),
            type: formData.type,
            host: formData.host,
            port: parseInt(formData.port, 10),
            username: formData.username || null,
            password: formData.password || null,
            api_address: formData.api_address || null,
            country: formData.country || null,
            city: formData.city || null,
            fraud_score: formData.fraud_score ? parseInt(formData.fraud_score, 10) : null,
            asn: formData.asn || null,
          }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || `Failed to ${isEditing ? 'update' : 'create'} proxy`)
      }

      // Close dialog and refresh
      setOpen(false)
      setFormData({
        type: '',
        host: '',
        port: '',
        username: '',
        password: '',
        api_address: '',
        country: '',
        city: '',
        fraud_score: '',
        asn: '',
      })
      router.refresh()
    } catch (error) {
      console.error(`Error ${isEditing ? 'updating' : 'creating'} proxy:`, error)
      alert(error instanceof Error ? error.message : `Failed to ${isEditing ? 'update' : 'create'} proxy`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || <Button>Add Proxy</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Proxy' : 'Add Proxy'}</DialogTitle>
            <DialogDescription>
              {isEditing ? 'Update the proxy configuration for this device.' : 'Add a proxy configuration for this device.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="type">Type *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value as 'HTTP' | 'SOCKS5' | 'SOCKS4' })}
                  required
                >
                  <SelectTrigger id="type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HTTP">HTTP</SelectItem>
                    <SelectItem value="SOCKS5">SOCKS5</SelectItem>
                    <SelectItem value="SOCKS4">SOCKS4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="port">Port *</Label>
                <Input
                  id="port"
                  type="number"
                  placeholder="e.g., 8080"
                  value={formData.port}
                  onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="host">Host (IP Address) *</Label>
              <Input
                id="host"
                placeholder="e.g., 123.21.23.21"
                value={formData.host}
                onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="api_address">API Address</Label>
              <Input
                id="api_address"
                placeholder="e.g., api.proxy-service.com"
                value={formData.api_address}
                onChange={(e) => setFormData({ ...formData, api_address: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  placeholder="Optional"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Optional"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  placeholder="e.g., United States"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  placeholder="e.g., New York"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="fraud_score">Fraud Score</Label>
                <Input
                  id="fraud_score"
                  type="number"
                  placeholder="e.g., 25"
                  value={formData.fraud_score}
                  onChange={(e) => setFormData({ ...formData, fraud_score: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="asn">ASN</Label>
                <Input
                  id="asn"
                  placeholder="e.g., AS12345"
                  value={formData.asn}
                  onChange={(e) => setFormData({ ...formData, asn: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (isEditing ? 'Updating...' : 'Creating...') : (isEditing ? 'Update Proxy' : 'Create Proxy')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

