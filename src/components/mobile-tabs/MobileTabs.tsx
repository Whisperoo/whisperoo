type MobileTabsProps = {
  tabs: {
    value: string;
    label: string;
    icon?: React.ReactNode;
  }[];
  value: string;
  onValueChange: (value: string) => void;
};

export const MobileTabs = ({ tabs, value, onValueChange }: MobileTabsProps) => {
  return (
    <div className="md:hidden w-full">
      <div className="flex overflow-x-auto gap-2 pb-2 no-scrollbar">
        {tabs.map((tab) => {
          const active = value === tab.value;

          return (
            <button
              key={tab.value}
              onClick={() => onValueChange(tab.value)}
              className={`
                flex-shrink-0
                whitespace-nowrap
                rounded-md
                px-4 py-2
                text-sm font-medium
                transition
                ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }
              `}
            >
              <span className="flex items-center gap-2">
                {tab.icon}
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
