import { Moon, Sun, Laptop } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="relative h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
          title="Toggle theme"
        >
          <Sun className="h-[1.15rem] w-[1.15rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-amber-500" />
          <Moon className="absolute h-[1.15rem] w-[1.15rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-sky-400" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuItem
          onClick={() => setTheme('light')}
          className="flex items-center gap-2 cursor-pointer font-medium"
        >
          <Sun className="h-4 w-4 text-amber-500" />
          <span>Light</span>
          {theme === 'light' && <span className="ml-auto text-primary text-xs font-bold">•</span>}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme('dark')}
          className="flex items-center gap-2 cursor-pointer font-medium"
        >
          <Moon className="h-4 w-4 text-sky-400" />
          <span>Dark</span>
          {theme === 'dark' && <span className="ml-auto text-primary text-xs font-bold">•</span>}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme('system')}
          className="flex items-center gap-2 cursor-pointer font-medium"
        >
          <Laptop className="h-4 w-4 text-muted-foreground" />
          <span>System</span>
          {theme === 'system' && <span className="ml-auto text-primary text-xs font-bold">•</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
