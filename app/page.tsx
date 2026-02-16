"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Home() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();

        if (profile?.role === "admin") {
          router.replace("/admin/dashboard");
        } else {
          router.replace("/founder/dashboard");
        }
      } else {
        setIsChecking(false);
      }
    };

    checkSession();
  }, [router]);

  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="animate-pulse text-gray-900 text-lg font-medium">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-xl border-b border-gray-100 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">AI</span>
            </div>
            <span className="text-xl font-semibold tracking-tight">Angels GCC</span>
          </div>
          <button
            onClick={() => router.push("/auth")}
            className="px-6 py-2 bg-black text-white rounded-full text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            Sign In
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-6xl md:text-7xl font-bold tracking-tight leading-tight mb-6">
            Investment decisions.
            <br />
            <span className="text-gray-400">Powered by AI.</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-12 leading-relaxed">
            Angels GCC AI combines artificial intelligence with Bocconi Alumni expertise
            to streamline startup evaluation and investment decisions.
          </p>
          <button
            onClick={() => router.push("/auth")}
            className="px-8 py-4 bg-black text-white rounded-full text-lg font-medium hover:bg-gray-800 transition-all hover:scale-105 shadow-lg"
          >
            Get Started
          </button>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-4">How it works</h2>
          <p className="text-center text-gray-600 mb-20 text-lg">
            From submission to investment decision in four seamless steps.
          </p>

          <div className="grid md:grid-cols-2 gap-16">
            {/* Step 1 */}
            <div className="space-y-4">
              <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center mb-4">
                <span className="text-white font-bold text-xl">1</span>
              </div>
              <h3 className="text-2xl font-semibold">Submit Your Materials</h3>
              <p className="text-gray-600 leading-relaxed">
                Founders sign up and submit their pitch deck, business plan, and supporting
                documents through our secure platform. Simple, fast, and straightforward.
              </p>
            </div>

            {/* Step 2 */}
            <div className="space-y-4">
              <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center mb-4">
                <span className="text-white font-bold text-xl">2</span>
              </div>
              <h3 className="text-2xl font-semibold">AI-Powered Analysis</h3>
              <p className="text-gray-600 leading-relaxed">
                Our AI system, supervised by experienced professionals in the Bocconi Alumni
                circuit, analyzes your submission and develops a comprehensive evaluation report.
              </p>
            </div>

            {/* Step 3 */}
            <div className="space-y-4">
              <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center mb-4">
                <span className="text-white font-bold text-xl">3</span>
              </div>
              <h3 className="text-2xl font-semibold">Investment Committee Review</h3>
              <p className="text-gray-600 leading-relaxed">
                Approved reports are forwarded to the Bocconi Club Investment Committee
                for strategic review and go/no-go decision making.
              </p>
            </div>

            {/* Step 4 */}
            <div className="space-y-4">
              <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center mb-4">
                <span className="text-white font-bold text-xl">4</span>
              </div>
              <h3 className="text-2xl font-semibold">Connect & Grow</h3>
              <p className="text-gray-600 leading-relaxed">
                Upon approval, our team reaches out to discuss next steps, investment terms,
                and partnership opportunities to accelerate your growth.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Why Angels GCC AI */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16">Why Angels GCC AI</h2>

          <div className="space-y-12">
            <div className="flex items-start space-x-6">
              <div className="w-1 h-16 bg-black rounded-full mt-1"></div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Speed & Efficiency</h3>
                <p className="text-gray-600">
                  AI-powered analysis reduces evaluation time from weeks to days,
                  giving you faster feedback on your investment opportunity.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-6">
              <div className="w-1 h-16 bg-black rounded-full mt-1"></div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Expert Oversight</h3>
                <p className="text-gray-600">
                  Every AI analysis is supervised by seasoned professionals from the
                  prestigious Bocconi Alumni network, ensuring quality and accuracy.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-6">
              <div className="w-1 h-16 bg-black rounded-full mt-1"></div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Access to Capital</h3>
                <p className="text-gray-600">
                  Direct connection to the Bocconi Club Investment Committee and a
                  network of experienced investors ready to back promising ventures.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-black text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Ready to get started?
          </h2>
          <p className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto">
            Join the next generation of founders leveraging AI-powered
            investment analysis to secure funding faster.
          </p>
          <button
            onClick={() => router.push("/auth")}
            className="px-8 py-4 bg-white text-black rounded-full text-lg font-medium hover:bg-gray-100 transition-all hover:scale-105"
          >
            Submit Your Pitch
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 bg-white border-t border-gray-100">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <div className="w-6 h-6 bg-black rounded flex items-center justify-center">
                <span className="text-white font-bold text-xs">AI</span>
              </div>
              <span className="font-semibold">Angels GCC</span>
            </div>
            <div className="text-sm text-gray-500">
              © 2026 Angels GCC AI. Powered by Bocconi Alumni Network.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
