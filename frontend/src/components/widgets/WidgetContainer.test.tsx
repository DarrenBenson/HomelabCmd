import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { WidgetContainer } from './WidgetContainer';

describe('WidgetContainer', () => {
  it('renders with title', () => {
    render(
      <WidgetContainer title="Test Widget">
        <p>Content</p>
      </WidgetContainer>
    );

    expect(screen.getByText('Test Widget')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('renders with icon when provided', () => {
    const icon = <span data-testid="test-icon">Icon</span>;
    render(
      <WidgetContainer title="Test Widget" icon={icon}>
        <p>Content</p>
      </WidgetContainer>
    );

    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });

  it('shows edit mode indicator when isEditMode is true', () => {
    render(
      <WidgetContainer title="Test Widget" isEditMode={true}>
        <p>Content</p>
      </WidgetContainer>
    );

    expect(screen.getByText('Drag to move')).toBeInTheDocument();
  });

  it('does not show edit mode indicator when isEditMode is false', () => {
    render(
      <WidgetContainer title="Test Widget" isEditMode={false}>
        <p>Content</p>
      </WidgetContainer>
    );

    expect(screen.queryByText('Drag to move')).not.toBeInTheDocument();
  });

  it('applies widget-header class for drag handle', () => {
    render(
      <WidgetContainer title="Test Widget">
        <p>Content</p>
      </WidgetContainer>
    );

    expect(screen.getByTestId('widget-header')).toHaveClass('widget-header');
  });

  it('generates correct test id from title', () => {
    render(
      <WidgetContainer title="Server Information">
        <p>Content</p>
      </WidgetContainer>
    );

    expect(screen.getByTestId('widget-container-server-information')).toBeInTheDocument();
  });

  // US0176: Widget Visibility Toggle tests

  describe('US0176: Widget Removal', () => {
    it('shows remove button in edit mode when onRemove is provided', () => {
      const onRemove = vi.fn();
      render(
        <WidgetContainer title="Test Widget" isEditMode={true} onRemove={onRemove}>
          <p>Content</p>
        </WidgetContainer>
      );

      expect(screen.getByTestId('widget-remove-button')).toBeInTheDocument();
    });

    it('does not show remove button when not in edit mode', () => {
      const onRemove = vi.fn();
      render(
        <WidgetContainer title="Test Widget" isEditMode={false} onRemove={onRemove}>
          <p>Content</p>
        </WidgetContainer>
      );

      expect(screen.queryByTestId('widget-remove-button')).not.toBeInTheDocument();
    });

    it('does not show remove button when onRemove is not provided', () => {
      render(
        <WidgetContainer title="Test Widget" isEditMode={true}>
          <p>Content</p>
        </WidgetContainer>
      );

      expect(screen.queryByTestId('widget-remove-button')).not.toBeInTheDocument();
    });

    it('calls onRemove when remove button is clicked', () => {
      const onRemove = vi.fn();
      render(
        <WidgetContainer title="Test Widget" isEditMode={true} onRemove={onRemove}>
          <p>Content</p>
        </WidgetContainer>
      );

      fireEvent.click(screen.getByTestId('widget-remove-button'));

      expect(onRemove).toHaveBeenCalledTimes(1);
    });

    it('stops event propagation when remove button is clicked', () => {
      const onRemove = vi.fn();
      const onContainerClick = vi.fn();
      render(
        <div onClick={onContainerClick}>
          <WidgetContainer title="Test Widget" isEditMode={true} onRemove={onRemove}>
            <p>Content</p>
          </WidgetContainer>
        </div>
      );

      fireEvent.click(screen.getByTestId('widget-remove-button'));

      expect(onRemove).toHaveBeenCalled();
      expect(onContainerClick).not.toHaveBeenCalled();
    });
  });
});
