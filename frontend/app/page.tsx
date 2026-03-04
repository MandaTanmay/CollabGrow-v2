"use client"



import { useState, useEffect } from "react"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, Lightbulb, Target, ArrowRight, Code, Palette, Database, Menu } from "lucide-react"
import Link from "next/link"
import { getPlatformStats } from "@/lib/supabase-queries"

export default function LandingPage() {
  const [stats, setStats] = useState({
    activeUsers: 0,
    completedProjects: 0,
    totalProjects: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadStats() {
      try {
        const platformStats = await getPlatformStats()
        console.log("✅ Platform stats loaded:", platformStats)
        setStats({
          activeUsers: platformStats.activeUsers,
          completedProjects: platformStats.completedProjects,
          totalProjects: platformStats.totalProjects,
        })
      } catch (error) {
        console.error("Error loading platform stats:", error)
      } finally {
        setLoading(false)
      }
    }
    loadStats()
  }, [])
  const { toast } = useToast()
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="border-b border-white/20 backdrop-blur-md bg-white/10 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              CollabGrow
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="#features"
              className="text-gray-600 hover:text-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md px-2 py-1"
            >
              Features
            </Link>
            <Link
              href="#how-it-works"
              className="text-gray-600 hover:text-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md px-2 py-1"
            >
              How it Works
            </Link>
            <Link
              href="/auth/login"
              className="text-gray-600 hover:text-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md px-2 py-1"
            >
              Sign In
            </Link>
            <Link href="/auth/register">
              <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                Get Started
              </Button>
            </Link>
          </nav>

          {/* Mobile menu button */}
          <Button variant="ghost" size="sm" className="md:hidden" aria-label="Open mobile menu">
            <Menu className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 md:py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <Badge className="mb-6 bg-blue-100 text-blue-700 border-blue-200">Connect • Collaborate • Create</Badge>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 bg-clip-text text-transparent leading-tight">
            Find Your Perfect
            <br />
            Project Partner
          </h1>
          <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
            Connect with students and learners who share your passion. Post projects, find collaborators, and build
            amazing things together with the right skills and expertise.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/register">
              <Button
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-lg px-8 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 w-full sm:w-auto"
              >
                Start Collaborating
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Button
              size="lg"
              variant="outline"
              className="text-lg px-8 border-2 bg-transparent hover:bg-white/50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 w-full sm:w-auto"
              onClick={() => {
                toast({
                  title: "Demo coming soon!",
                  description: "Sign up to get early access.",
                })
              }}
            >
              Watch Demo
            </Button>
          </div>

          <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>
                {loading ? "..." : stats.activeUsers > 0 ? `${stats.activeUsers}+ Active Students` : "Join Our Community"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span>
                {loading ? "..." : stats.completedProjects > 0 ? `${stats.completedProjects}+ Projects Completed` : "Start Your First Project"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              <span>
                {loading ? "..." : stats.totalProjects > 0 ? `${stats.totalProjects} Total Projects` : "Start Creating"}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container mx-auto px-4 py-16 md:py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Why Choose CollabGrow?
          </h2>
          <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto">
            Everything you need to find, connect, and collaborate with the perfect project partners
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <Card className="border-0 bg-white/60 backdrop-blur-sm shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 group">
            <CardHeader>
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Target className="w-6 h-6 text-white" />
              </div>
              <CardTitle className="text-xl">Smart Matching</CardTitle>
              <CardDescription className="text-gray-600">
                Our AI-powered system matches you with collaborators based on complementary skills and project interests
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-0 bg-white/60 backdrop-blur-sm shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 group">
            <CardHeader>
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Lightbulb className="w-6 h-6 text-white" />
              </div>
              <CardTitle className="text-xl">Project Discovery</CardTitle>
              <CardDescription className="text-gray-600">
                Browse exciting project ideas or post your own. Find opportunities that match your skills and interests
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-0 bg-white/60 backdrop-blur-sm shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 group">
            <CardHeader>
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6 text-white" />
              </div>
              <CardTitle className="text-xl">Team Building</CardTitle>
              <CardDescription className="text-gray-600">
                Build diverse teams with the right mix of skills. Collaborate seamlessly and learn from each other
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      <section
        id="how-it-works"
        className="container mx-auto px-4 py-16 md:py-20 bg-white/30 backdrop-blur-sm rounded-3xl mx-4"
      >
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
          <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto">Get started in just three simple steps</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-6 text-white text-2xl font-bold">
              1
            </div>
            <h3 className="text-xl font-semibold mb-4">Create Your Profile</h3>
            <p className="text-gray-600">
              Sign up and showcase your skills, interests, and project experience to attract the right collaborators
            </p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-6 text-white text-2xl font-bold">
              2
            </div>
            <h3 className="text-xl font-semibold mb-4">Find or Post Projects</h3>
            <p className="text-gray-600">
              Browse existing projects that match your skills or post your own project idea to find collaborators
            </p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-red-500 rounded-full flex items-center justify-center mx-auto mb-6 text-white text-2xl font-bold">
              3
            </div>
            <h3 className="text-xl font-semibold mb-4">Start Collaborating</h3>
            <p className="text-gray-600">
              Connect with your team, use our collaboration tools, and build amazing projects together
            </p>
          </div>
        </div>
      </section>

      {/* Skills Showcase */}
      <section className="container mx-auto px-4 py-16 md:py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Popular Skills & Technologies</h2>
          <p className="text-lg md:text-xl text-gray-600">Connect with experts in these trending technologies</p>
        </div>

        <div className="flex flex-wrap justify-center gap-4">
          {[
            { name: "React", icon: Code, color: "from-blue-500 to-cyan-500" },
            { name: "Python", icon: Code, color: "from-green-500 to-blue-500" },
            { name: "UI/UX Design", icon: Palette, color: "from-pink-500 to-purple-500" },
            { name: "Node.js", icon: Code, color: "from-green-600 to-green-700" },
            { name: "Machine Learning", icon: Database, color: "from-purple-500 to-indigo-500" },
            { name: "Mobile Dev", icon: Code, color: "from-orange-500 to-red-500" },
          ].map((skill) => (
            <Badge
              key={skill.name}
              className={`px-4 py-2 text-white bg-gradient-to-r ${skill.color} hover:scale-105 transition-transform cursor-pointer focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2`}
              tabIndex={0}
              role="button"
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  console.log(`Selected skill: ${skill.name}`)
                }
              }}
            >
              <skill.icon className="w-4 h-4 mr-2" />
              {skill.name}
            </Badge>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16 md:py-20">
        <Card className="border-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-center p-8 md:p-12">
          <CardContent className="space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold">Ready to Start Your Next Project?</h2>
            <p className="text-lg md:text-xl opacity-90 max-w-2xl mx-auto">
              Join thousands of students and learners who are already collaborating and building amazing projects
              together
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth/register">
                <Button
                  size="lg"
                  variant="secondary"
                  className="text-lg px-8 focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600 w-full sm:w-auto"
                >
                  Join CollabGrow Today
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <Link href="/" className="flex items-center gap-2 mb-4 md:mb-0 hover:opacity-80 transition-opacity">
              <div className="w-6 h-6 bg-gradient-to-br from-blue-600 to-purple-600 rounded-md flex items-center justify-center">
                <Users className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                CollabGrow
              </span>
            </Link>
            <p className="text-gray-600 text-sm">© 2024 CollabGrow. Empowering student collaboration worldwide.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
