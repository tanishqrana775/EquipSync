import { Link } from 'react-router-dom';
import { Share2, Heart, Shield, Cpu, Sparkles } from 'lucide-react';

export function MarketingFooter() {
  return (
    <footer className="border-t border-border/70 bg-card/60 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Brand Col */}
          <div className="md:col-span-1 space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Share2 className="h-4 w-4" />
              </div>
              <span className="text-lg font-bold text-foreground">
                CampusShare
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Centralized campus resource sharing and custody management platform. Reducing campus waste and unlocking collaborative potential.
            </p>
            <div className="flex items-center gap-2 pt-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Phase 1 Architecture Complete</span>
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h5 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-3">
              Application
            </h5>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>
                <Link to="/app/institution" className="hover:text-foreground transition-colors">
                  Institution Dashboard
                </Link>
              </li>
              <li>
                <Link to="/app/user" className="hover:text-foreground transition-colors">
                  User / Student Dashboard
                </Link>
              </li>
              <li>
                <Link to="/app/institution/resources" className="hover:text-foreground transition-colors">
                  Resource Management
                </Link>
              </li>
              <li>
                <Link to="/app/discover" className="hover:text-foreground transition-colors">
                  Resource Discovery
                </Link>
              </li>
              <li>
                <Link to="/app/bookings/bk-2024-001" className="hover:text-foreground transition-colors">
                  Chain of Custody
                </Link>
              </li>
            </ul>
          </div>

          {/* Technology stack */}
          <div>
            <h5 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-3">
              Technology Stack
            </h5>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="flex items-center gap-1.5">
                <Cpu className="h-3 w-3 text-primary" /> React 18 + Vite + TypeScript
              </li>
              <li className="flex items-center gap-1.5">
                <Shield className="h-3 w-3 text-emerald-500" /> Tailwind CSS v3.4 + Radix
              </li>
              <li>shadcn/ui (New York Style)</li>
              <li>React Router DOM v6</li>
              <li>next-themes (Light / Dark)</li>
            </ul>
          </div>

          {/* Compliance & Standards */}
          <div>
            <h5 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-3">
              Security & Custody
            </h5>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Every equipment loan is sealed with cryptographically traceable handover codes and timestamped faculty clearance records.
            </p>
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Status: Mock Data Simulation Active</span>
            </div>
          </div>
        </div>

        <div className="border-t border-border/60 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} CampusShare Platform. Built with modern SaaS architecture.</p>
          <div className="flex items-center gap-1">
            <span>Engineered for campus collaboration</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
