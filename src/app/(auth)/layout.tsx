import { PageTransition } from "@/components/layout/page-transition";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden bg-gradient-to-br from-[#D4654A] to-[#B84E38]">
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full border border-white/20" />
        <div className="absolute top-32 -right-10 w-56 h-56 rounded-full bg-white/10" />
        <div className="absolute -bottom-32 -left-16 w-96 h-96 rounded-full border border-white/10" />
        <div className="absolute bottom-20 left-20 w-40 h-40 rounded-full bg-white/5" />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-white flex items-center justify-center">
              <span className="text-[#D4654A] font-bold text-lg">L</span>
            </div>
            <span className="text-white font-semibold text-lg">LeaveDesk</span>
          </div>

          <div className="text-white">
            <h2 className="text-3xl font-bold leading-tight mb-4">
              Manage your team&apos;s
              <br />
              time off, effortlessly.
            </h2>
            <p className="text-white/70 text-base max-w-sm">
              A simple and modern way to handle leave requests, approvals, and
              team availability.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center bg-white p-6 lg:p-12">
        <PageTransition>{children}</PageTransition>
      </div>
    </div>
  );
}
