/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type JobStatus =
  | 'Assigned'
  | 'Accepted'
  | 'Travelling'
  | 'Reached'
  | 'Inspection'
  | 'Installing'
  | 'Gas Charging'
  | 'Testing'
  | 'Completed'
  | 'Closed'
  | 'Rejected';

export interface OrderNote {
  id: string;
  author: string;
  message: string;
  timestamp: string;
}

export interface MaterialItem {
  id: string;
  name: string;
  quantity: number;
  remarks?: string;
}

export interface WooCommerceOrder {
  id: number;
  number: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  customer_address: string;
  latitude: number;
  longitude: number;
  preferred_time: string;
  payment_status: 'Paid' | 'Unpaid' | 'Cash on Delivery';
  service_type: string;
  products: string[];
  technician_status: JobStatus;
  rejection_reason?: string;
  notes: OrderNote[];
  photos: string[];
  materials: MaterialItem[];
  signature: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface AppStats {
  assigned: number;
  accepted: number;
  completed: number;
  rejected: number;
}
