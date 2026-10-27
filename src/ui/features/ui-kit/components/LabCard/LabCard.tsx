import styles from './LabCard.module.css'

type LabCardProps = {
  readonly description: string
  readonly href: string
  readonly id: string
  readonly preview?: string
  readonly title: string
  readonly 'data-testid'?: string
}

export function LabCard({
  description,
  href,
  id,
  preview,
  title,
  'data-testid': testId,
}: LabCardProps) {
  return (
    <a className={styles.card} data-has-preview={preview ? 'true' : 'false'} data-testid={testId} href={href}>
      <span className={styles.thumb}>
        {preview ? (
          <img alt={`${title} preview`} className={styles.image} loading="lazy" src={preview} />
        ) : (
          <span className={styles.missing}>No preview captured</span>
        )}
      </span>
      <span className={styles.body}>
        <span className={styles.title}>{title}</span>
        <span className={styles.description}>{description}</span>
        <span className={styles.id}>{id}</span>
      </span>
    </a>
  )
}
