import { Building2, GraduationCap, ArrowLeftRight } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/providers/AuthProvider';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

export function RoleSwitcher() {
  const { role, setRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSelectRole = (newRole: 'institution' | 'user') => {
    setRole(newRole);
    // When switching role inside app, smoothly navigate to the appropriate dashboard
    if (location.pathname.startsWith('/app')) {
      if (newRole === 'institution') {
        navigate('/app/institution');
      } else {
        navigate('/app/user');
      }
    }
  };

  const isInstitution = role === 'institution';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 md:h-9 px-2.5 md:px-3 rounded-lg border-primary/20 bg-primary/5 hover:bg-primary/10 text-foreground transition-all duration-200 gap-2 font-medium"
        >
          <div className="flex items-center gap-1.5">
            {isInstitution ? (
              <Building2 className="h-4 w-4 text-primary" />
            ) : (
              <GraduationCap className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            )}
            <span className="hidden sm:inline text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Demo:
            </span>
            <span className="text-xs md:text-sm font-semibold capitalize text-foreground">
              {role}
            </span>
          </div>
          <ArrowLeftRight className="h-3 w-3 text-muted-foreground opacity-70 ml-0.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 p-2">
        <DropdownMenuLabel className="flex items-center justify-between pb-1.5">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Switch Demo Persona
          </span>
          <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal">
            Preview
          </Badge>
        </DropdownMenuLabel>
        <p className="text-[11px] text-muted-foreground px-2 pb-2 leading-relaxed">
          Toggle roles instantly to preview both administrative management & borrower workflows.
        </p>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => handleSelectRole('institution')}
          className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
            isInstitution ? 'bg-primary/10 text-primary font-medium' : ''
          }`}
        >
          <div className="mt-0.5 p-1.5 rounded-md bg-primary/10 text-primary">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-foreground">
              Institution Admin
            </span>
            <span className="text-xs text-muted-foreground">
              Manage inventory, approvals & custody
            </span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleSelectRole('user')}
          className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors mt-1 ${
            !isInstitution ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-medium' : ''
          }`}
        >
          <div className="mt-0.5 p-1.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <GraduationCap className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-foreground">
              Campus User / Student
            </span>
            <span className="text-xs text-muted-foreground">
              Discover, reserve & borrow equipment
            </span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
