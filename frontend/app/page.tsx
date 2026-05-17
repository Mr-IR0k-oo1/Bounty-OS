"use client"

import { redirect } from "next/navigation"

// This is the main page component that will redirect to the projects page
export default function Home() {
  redirect("/projects")
  return null
}
