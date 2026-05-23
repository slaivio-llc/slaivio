"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";

import {
  getKnowledgeItems,
  getGoodsRules,
  getPricingRules,
  createKnowledgeItem,
  createGoodsRule,
  createPricingRule,
} from "@/services/settings";

export default function SettingsPage() {
  const [knowledge, setKnowledge] = useState<any[]>([]);
  const [goods, setGoods] = useState<any[]>([]);
  const [pricing, setPricing] = useState<any[]>([]);

  async function load() {
    const [k, g, p] = await Promise.all([
      getKnowledgeItems(),
      getGoodsRules(),
      getPricingRules(),
    ]);

    setKnowledge(k);
    setGoods(g);
    setPricing(p);
  }

  useEffect(() => {
    load();
  }, []);

  async function addKnowledge() {
    await createKnowledgeItem({
      title: "Adresse Kinshasa",
      content: "Notre bureau est situé à Kinshasa, Lingwala.",
      category: "ADDRESS",
    });

    load();
  }

  async function addGoodsRule() {
    await createGoodsRule({
      goods_name: "Téléphone",
      category: "ELECTRONICS",
      is_accepted: true,
      pricing_mode: "PER_PIECE",
      note: "Téléphone accepté avec contrôle.",
    });

    load();
  }

  async function addPricingRule() {
    await createPricingRule({
      origin_country: "Chine",
      destination_country: "RDC",
      rule_type: "PER_KG",
      price: 20,
      currency: "USD",
      goods_type: "general",
    });

    load();
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        <h1 className="text-3xl font-bold">
          Settings
        </h1>

        <p className="mt-2 text-muted-foreground">
          Knowledge, goods rules and pricing configuration.
        </p>

        <div className="mt-8 grid grid-cols-3 gap-6">
          <section className="rounded-2xl border p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                Knowledge
              </h2>

              <button
                onClick={addKnowledge}
                className="rounded-xl bg-black px-4 py-2 text-sm text-white"
              >
                Add
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {knowledge.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border p-4"
                >
                  <div className="font-semibold">
                    {item.title}
                  </div>

                  <div className="mt-1 text-xs text-muted-foreground">
                    {item.category}
                  </div>

                  <p className="mt-2 text-sm">
                    {item.content}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                Goods Rules
              </h2>

              <button
                onClick={addGoodsRule}
                className="rounded-xl bg-black px-4 py-2 text-sm text-white"
              >
                Add
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {goods.map((rule) => (
                <div
                  key={rule.id}
                  className="rounded-xl border p-4"
                >
                  <div className="font-semibold">
                    {rule.goods_name}
                  </div>

                  <div className="mt-1 text-xs text-muted-foreground">
                    {rule.category}
                  </div>

                  <p className="mt-2 text-sm">
                    {rule.note}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                Pricing
              </h2>

              <button
                onClick={addPricingRule}
                className="rounded-xl bg-black px-4 py-2 text-sm text-white"
              >
                Add
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {pricing.map((rule) => (
                <div
                  key={rule.id}
                  className="rounded-xl border p-4"
                >
                  <div className="font-semibold">
                    {rule.origin_country} → {rule.destination_country}
                  </div>

                  <div className="mt-1 text-sm">
                    {rule.price} {rule.currency} / {rule.rule_type}
                  </div>

                  <div className="mt-1 text-xs text-muted-foreground">
                    {rule.goods_type || "general"}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}
