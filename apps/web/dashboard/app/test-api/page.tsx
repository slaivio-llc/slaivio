"use client";

import { useEffect, useState } from "react";

import { api } from "@/services/api";

export default function TestApiPage() {
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    api
      .get("/health")
      .then((response) => {
        setStatus(response.data.status);
      })
      .catch(() => {
        setStatus("error");
      });
  }, []);

  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold">
        API Status: {status}
      </h1>
    </div>
  );
}
