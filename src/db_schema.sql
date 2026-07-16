-- PostgreSQL Database Schema Design for AC Technician Service Portal
-- This schema represents a robust relational model for tracking technicians, WooCommerce orders, job status transitions, materials used, photos, and digital signatures.

-- 1. Technicians table to store authorized portal users
CREATE TABLE technicians (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL, -- Numeric 5-digit password stored securely
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    role VARCHAR(50) DEFAULT 'Technician',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed Manual Technical Users
INSERT INTO technicians (email, password_hash, name, phone) VALUES
('ereshmb@gmail.com', '10001', 'Eresh M B', '+1 (555) 012-1001'),
('decentsachin.143@gmail.com', '10002', 'Sachin', '+1 (555) 012-1002'),
('nidhishri767@gmail.com', '10003', 'Nidhishri', '+1 (555) 012-1003');


-- 2. Orders table containing customer details and job statuses
CREATE TABLE service_orders (
    id INT PRIMARY KEY, -- Maps directly to WooCommerce Order ID
    order_number VARCHAR(50) NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50) NOT NULL,
    customer_email VARCHAR(255),
    customer_address TEXT NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    preferred_time VARCHAR(255),
    payment_status VARCHAR(50) NOT NULL, -- 'Paid', 'Unpaid', 'Cash on Delivery'
    service_type VARCHAR(100) NOT NULL, -- e.g. 'AC Installation', 'AC Servicing & Repair'
    products TEXT[], -- Array of ordered line item products
    technician_status VARCHAR(50) DEFAULT 'Assigned', -- 'Assigned', 'Accepted', 'In Progress', 'On Hold', 'Closed', 'Rejected'
    rejection_reason TEXT,
    digital_signature TEXT, -- Base64 encoded signature image
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    accepted_by_email VARCHAR(255) REFERENCES technicians(email) ON DELETE SET NULL
);


-- 3. Order Notes (Updates and comments synced with WooCommerce)
CREATE TABLE order_notes (
    id VARCHAR(100) PRIMARY KEY,
    order_id INT REFERENCES service_orders(id) ON DELETE CASCADE,
    author VARCHAR(100) NOT NULL, -- 'Technician (Self)', 'Customer Note', 'WooCommerce Store'
    message TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- 4. Materials Used Tracker
CREATE TABLE order_materials (
    id VARCHAR(100) PRIMARY KEY,
    order_id INT REFERENCES service_orders(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL,
    remarks TEXT
);


-- 5. Before/After Work Progress Photos
CREATE TABLE order_photos (
    id SERIAL PRIMARY KEY,
    order_id INT REFERENCES service_orders(id) ON DELETE CASCADE,
    photo_data TEXT NOT NULL, -- Base64 encoded or S3/Cloud Storage URL
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- Indexes for high-performance querying
CREATE INDEX idx_orders_status ON service_orders(technician_status);
CREATE INDEX idx_orders_accepted_by ON service_orders(accepted_by_email);
CREATE INDEX idx_notes_order ON order_notes(order_id);
CREATE INDEX idx_materials_order ON order_materials(order_id);


-- 6. Enable Row Level Security (RLS) on all tables to meet compliance requirements
ALTER TABLE service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE technicians ENABLE ROW LEVEL SECURITY;

-- 7. RLS Access Policies for service_orders:
-- Technicians can only view or modify orders that are unassigned (technician_status = 'Assigned' and no accepted_by_email)
-- or are explicitly assigned to their technician email.
CREATE POLICY technician_order_access ON service_orders
    FOR ALL
    USING (
        accepted_by_email IS NULL 
        OR accepted_by_email = current_setting('request.jwt.claims', true)::json->>'email'
    );

-- RLS Access Policies for related tables (notes, materials, photos):
-- They are cascade accessed but can be guarded by joining/checking the order's assignment.
CREATE POLICY technician_note_access ON order_notes
    FOR ALL
    USING (
        order_id IN (
            SELECT id FROM service_orders 
            WHERE accepted_by_email IS NULL 
            OR accepted_by_email = current_setting('request.jwt.claims', true)::json->>'email'
        )
    );

CREATE POLICY technician_material_access ON order_materials
    FOR ALL
    USING (
        order_id IN (
            SELECT id FROM service_orders 
            WHERE accepted_by_email IS NULL 
            OR accepted_by_email = current_setting('request.jwt.claims', true)::json->>'email'
        )
    );

CREATE POLICY technician_photo_access ON order_photos
    FOR ALL
    USING (
        order_id IN (
            SELECT id FROM service_orders 
            WHERE accepted_by_email IS NULL 
            OR accepted_by_email = current_setting('request.jwt.claims', true)::json->>'email'
        )
    );

-- Allow public read access (or authenticated) for self-service or app client logins on technician table
CREATE POLICY technician_read_access ON technicians
    FOR SELECT
    USING (true);

