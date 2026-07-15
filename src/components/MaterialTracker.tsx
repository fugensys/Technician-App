/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Plus, Package, Trash2 } from 'lucide-react';
import { MaterialItem } from '../types';

interface MaterialTrackerProps {
  materials: MaterialItem[];
  onAdd: (material: Omit<MaterialItem, 'id'>) => void;
}

const COMMON_MATERIALS = [
  { name: 'Copper Pipe (1/4 & 1/2)', defaultQty: 10, unit: 'ft' },
  { name: 'R32 Refrigerant Gas', defaultQty: 1.2, unit: 'kg' },
  { name: 'R410A Refrigerant Gas', defaultQty: 1.5, unit: 'kg' },
  { name: 'Heavy Duty Condenser Bracket', defaultQty: 1, unit: 'set' },
  { name: 'Drain Water Pipe', defaultQty: 15, unit: 'ft' },
  { name: 'Electric Wire (3 Core)', defaultQty: 12, unit: 'ft' },
  { name: 'Insulation Sleeves Tape', defaultQty: 2, unit: 'roll' },
];

export default function MaterialTracker({ materials, onAdd }: MaterialTrackerProps) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [remarks, setRemarks] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !quantity) return;

    onAdd({
      name: name.trim(),
      quantity: parseFloat(quantity),
      remarks: remarks.trim() || undefined,
    });

    setName('');
    setQuantity('1');
    setRemarks('');
  };

  const handleSelectCommon = (common: typeof COMMON_MATERIALS[0]) => {
    setName(common.name);
    setQuantity(common.defaultQty.toString());
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center space-x-2">
        <Package className="w-5 h-5 text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-700">Parts & Materials Used</h3>
      </div>

      {/* Materials List */}
      {materials.length > 0 ? (
        <div className="border border-slate-100 rounded-xl overflow-hidden bg-white shadow-sm">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-100">
                <th className="py-2 px-3">Item Name</th>
                <th className="py-2 px-3 text-right">Qty</th>
                <th className="py-2 px-3">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {materials.map((m) => (
                <tr key={m.id}>
                  <td className="py-2.5 px-3 font-medium">{m.name}</td>
                  <td className="py-2.5 px-3 text-right font-mono bg-slate-50/50">{m.quantity}</td>
                  <td className="py-2.5 px-3 text-slate-400 italic truncate max-w-[120px]">{m.remarks || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-4 border border-dashed border-slate-200 rounded-xl bg-slate-50 text-slate-400 text-xs">
          No parts or materials logged for this service yet.
        </div>
      )}

      {/* Quick Select Suggestions */}
      <div>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
          Frequently Used AC Materials
        </span>
        <div className="flex flex-wrap gap-1.5">
          {COMMON_MATERIALS.map((c, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelectCommon(c)}
              className="text-[11px] bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/60 rounded-full px-2.5 py-1 transition-colors"
            >
              + {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Add New Material Form */}
      <form onSubmit={handleSubmit} className="bg-slate-50/50 border border-slate-100 rounded-xl p-3 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Part / Material Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g., Copper Pipe (3/8 Inch)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Qty
            </label>
            <input
              type="number"
              required
              step="any"
              min="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Notes / Details
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              placeholder="e.g., Used for outdoor bracket extension"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center space-x-1 shadow-sm transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
