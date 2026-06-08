'use client'

import React, { useEffect, useRef } from 'react'
import { motion, useAnimation, useInView } from 'framer-motion'

interface ScrollRevealProps {
  children: React.ReactNode
  delay?: number
  className?: string
  stagger?: boolean
}

export const ScrollReveal: React.FC<ScrollRevealProps> = ({ children, delay = 0, className, stagger = false }) => {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '0px 0px -12% 0px' })
  const controls = useAnimation()

  useEffect(() => {
    if (isInView) {
      controls.start('visible')
    }
  }, [isInView, controls])

  const variants = {
    hidden: { opacity: 0, y: 8 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.42,
        ease: [0.22, 1, 0.36, 1],
        delay,
      },
    },
  }

  if (stagger && React.isValidElement(children) && children.props.children) {
    return (
      <motion.div
        ref={ref}
        initial="hidden"
        animate={controls}
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: {
              delayChildren: 0.04,
              staggerChildren: 0.06,
            },
          },
        }}
        className={className}
      >
        {React.Children.map(children.props.children, (child, index) => (
          <motion.div key={index} variants={variants}>
            {child}
          </motion.div>
        ))}
      </motion.div>
    )
  }

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={controls}
      variants={variants}
      className={className}
    >
      {children}
    </motion.div>
  )
}

ScrollReveal.displayName = 'ScrollReveal'
