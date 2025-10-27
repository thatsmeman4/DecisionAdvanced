"use client";
import { useState } from "react";

// Demo sử dụng các component UI cần thiết (Button, Card, Input...)
export default function TestZamaPage() {
  const [input, setInput] = useState("");
  const [cards] = useState([
    { title: "Card 1", desc: "Đây là card demo 1" },
    { title: "Card 2", desc: "Đây là card demo 2" },
  ]);

  return (
    <section className="container mx-auto py-12 px-4 max-w-2xl">
      <h1 className="text-3xl font-bold mb-8">Test Zama UI Components</h1>
      <div className="mb-6">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Nhập gì đó..."
          className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none mb-4"
        />
        <button className="px-8 py-3 rounded-lg font-semibold bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition text-white">
          Button ZamaTheme
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {cards.map((c, idx) => (
          <div
            key={idx}
            className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6 hover:bg-gray-700/50 hover:border-gray-600/50 transition-all duration-300"
          >
            <div className="font-semibold text-lg mb-2">{c.title}</div>
            <div className="text-gray-400 text-sm mb-4">{c.desc}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
