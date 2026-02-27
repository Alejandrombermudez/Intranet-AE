import { Car, Truck, Bike } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface Vehicle {
  id: string
  name: string
  color: string
  icon: LucideIcon
}

export const VEHICLES: Vehicle[] = [
  { id: 'camioneta1', name: 'Chevrolet - Samurai', color: '#0d7377', icon: Car },
  { id: 'camioneta2', name: 'Camioneta Foton',     color: '#059669', icon: Truck },
  { id: 'moto',       name: 'Susuki DR 150',       color: '#d97706', icon: Bike },
  { id: 'moto2',      name: 'Yamaha XTZ-150',      color: '#7c3aed', icon: Bike },
]

export const VEHICLE_MAP: Record<string, Vehicle> = Object.fromEntries(
  VEHICLES.map(v => [v.id, v])
)
