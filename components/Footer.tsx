'use client'

import { usePathname } from 'next/navigation'
import Image from 'next/image'

export default function Footer() {
    const pathname = usePathname()

    // Amaga el footer si l'usuari està a la pàgina principal de la simulació/xat (/)
    if (pathname === '/') {
        return null
    }

    return (
        <footer className="w-full py-4 border-t border-stone-200/60 text-center flex items-center justify-center gap-6 opacity-40 hover:opacity-100 transition-opacity">
            <a href="https://linkedin.com/showcase/synusia-io" target="_blank" rel="noreferrer">
                <Image src="/linkedin.svg" alt="LinkedIn" width={20} height={20} />
            </a>
            <a href="https://instagram.com/synusia.io" target="_blank" rel="noreferrer">
                <Image src="/instagram.svg" alt="Instagram" width={20} height={20} />
            </a>
            <a href="https://synusia.io/" target="_blank" rel="noreferrer">
                <Image src="/web.svg" alt="Web" width={20} height={20} />
            </a>
        </footer>
    )
}