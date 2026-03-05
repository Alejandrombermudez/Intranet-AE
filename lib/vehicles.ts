import { Car, Truck, Bike } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type VehicleType = 'car' | 'truck' | 'moto'

export interface Vehicle {
  id: string
  name: string
  color: string
  icon: LucideIcon
  type: VehicleType
}

export const VEHICLES: Vehicle[] = [
  { id: 'camioneta1', name: 'Chevrolet - Samurai', color: '#0d7377', icon: Car,   type: 'car'   },
  { id: 'camioneta2', name: 'Camioneta Foton',     color: '#059669', icon: Truck, type: 'truck' },
  { id: 'moto',       name: 'Susuki DR 150',       color: '#d97706', icon: Bike,  type: 'moto'  },
  { id: 'moto2',      name: 'Yamaha XTZ-150',      color: '#7c3aed', icon: Bike,  type: 'moto'  },
]

export const VEHICLE_MAP: Record<string, Vehicle> = Object.fromEntries(
  VEHICLES.map(v => [v.id, v])
)
