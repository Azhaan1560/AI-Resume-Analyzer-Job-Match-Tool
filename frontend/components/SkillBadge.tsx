'use client';

interface SkillBadgeProps{
    skill: string;

    variant: 'matched' | 'missing' | 'neutral';
}

export default function SkillBadge({ skill, variant }: SkillBadgeProps){
    
    const variantClasses = {
    matched: 'bg-green-100 text-green-800 border-green-200',
    missing: 'bg-red-100  text-red-800  border-red-200',
    neutral: 'bg-gray-100 text-gray-700 border-gray-200',
    };   
    
    return (
        <span
            className={`
                inline-flex item-center
                px-3 py-1
                rounded-full
                border
                text-sm font-mdeium
                ${variantClasses[variant]}
                `}
        >
            {/* Show a small icon before the skill name based on variant */}
            {variant === 'matched' && <span className="mr-1"
            >✓</span>}

            {variant === 'missing' && <span className="mr-1"
            >✗</span>}

            {/* The skill name passed in via props */}
            {skill}
        </span>
    )
}