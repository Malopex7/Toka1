"use client";
import { useEffect, useState } from 'react';
export default function TestPage() {
  const [msg, setMsg] = useState("");
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/test`)
      .then(res => res.json())
      .then(data => setMsg(data.message));
  }, []);
  return <div>{msg || "Loading..."}</div>;
}
